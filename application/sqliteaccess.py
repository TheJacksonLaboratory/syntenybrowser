import os
import pprint
import sqlite3
from itertools import chain


SCRIPT_DIR = os.path.dirname(os.path.realpath(__file__))
DB_PATH = os.path.join(SCRIPT_DIR, '..', 'synteny.db')

def count_ont_children(ont_id, ont_term):
    """

    :param ont_id:
    :param ont_term:
    :return:
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    query_vars = (ont_id + ":%",
                  "%" + ont_term + "%",
                  "%" + ont_term + "%",)

    c.execute('''
        SELECT SUM(count) 
            FROM on_terms 
            WHERE id LIKE ? 
              AND (id LIKE ? OR name LIKE ?)
              AND count IS NOT NULL; 
    ''', query_vars)

    return c.fetchone()[0]

# type-ahead and autocomplete related functions
def get_gene_symbols(taxon_id):
    """
    Get a dict of gene symbols associated with the species corresponding to taxon_id.

    :param taxon_id: species id
    :return: an iterable dictionary of the gene symbols
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    c.execute('''
        SELECT DISTINCT gene_symbol AS term
            FROM gene 
            WHERE gene_taxonid = ?
        ''', (taxon_id,)
    )

    for row in c:
        yield _dictify_row(c, row)


def get_qtl_symbols(taxon_id):
    """
    Get a dict of QTL symbols associated with the species corresponding to taxon_id.

    :param taxon_id: species id
    :return: an iterable dictionary of QTL symbols
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    c.execute('''
        SELECT DISTINCT name  AS term 
            FROM feature 
            WHERE type = "QTL" AND taxon_id = ? 
        ''', (taxon_id,)
    )

    for row in c:
        yield _dictify_row(c, row)


def get_ont_terms(ont_id):
    """
    Returns a dict of term names from the specified ontology

    :param ont_id:
    :return:
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    symbol = (ont_id + ":%",)
    c.execute('''
        SELECT DISTINCT name AS term 
            FROM on_terms 
            WHERE id LIKE ?
        ''', (symbol)
    )

    for row in c:
        yield _dictify_row(c, row)


def get_ont_ids(ont_id):
    """
    some more text

    :param
    :return:
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    c.execute('''
        SELECT DISTINCT id AS term 
            FROM on_terms 
            WHERE id LIKE ?
        ''', (ont_id,)
    )

    for row in c:
        yield _dictify_row(c, row)


def get_ont_terms_ids(ont_id):
    """
    Get a dict of ontology ids and terms associated with the specified ont_id (i.e. "GO, DO, MP, ...)

    :param ont_id: ontology id
    :return: an iterable dictionary of ontology ids and terms
    """
    generators = chain(get_ont_terms(ont_id), get_ont_ids(ont_id))

    for item in generators:
        yield item


def _dictify_row(cursor, row):
    """Turns the given row into a dictionary where the keys are the column names"""
    return {col[0]: row[i] for i, col in enumerate(cursor.description)}


def get_blocks(ref_taxon, comp_taxon, include_anchors=False, ref_chr=None):
    """
    Get syntenic blocks between the given reference and comparison genomes
    :param ref_taxon:       the NCBI ID for the reference genome
    :param comp_taxon:      the NCBI ID for the comparison genome
    :param include_anchors: if true, ref_anchor_points and comp_anchor_points will be included in the returned
                            dictionaries as described below
    :param ref_chr:         the reference chromosome that we're getting data for (None indicates that we should get
                            data for all chromosomes)
    :return:    this function returns an iterable of dictionaries (one dictionary per block) sorted by reference chromosome
                and start position. Each dictionary will include the following properties:

    * ref_chr:              the reference block's chromosome
    * ref_start_pos:        the reference block's start position (base pairs)
    * ref_end_pos:          the reference block's end position (base pairs)
    * ref_taxonid:          the NCBI taxon ID for the reference genome
    * ref_anchor_points:    an optional list of base pair positions for the reference anchor points that
                            will only be present when include_anchors is True. These anchor points will
                            be sorted in ascending order, will include at least the starting and ending
                            point of this ref block and will have an arbitrary number of interior anchor
                            points. Each ref_anchor_point will match up to the comp_anchor_point at the
                            same index (ie when the view is centered on the position ref_anchor_point[i]
                            the comparison view will be centered on comp_anchor_point[i])

    * comp_chr:             the comparison block's chromosome
    * comp_start_pos:       the comparison block's start position (base pairs)
    * comp_end_pos:         the comparison block's end position (base pairs)
    * comp_taxonid:         the NCBI taxon ID for the comparison genome
    * comp_anchor_points:   see description for ref_anchor_points
    * same_orientation:     boolean indicating whether the reference and comparison blocks are in the same
                            orientation or not
    """

    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    if ref_chr is None:
        c.execute('''
            SELECT * FROM syntenic_block
            WHERE ref_taxonid=:ref_taxonid AND comp_taxonid=:comp_taxonid
            ORDER BY ref_chr, ref_start_pos
        ''', {
            'ref_taxonid': ref_taxon,
            'comp_taxonid': comp_taxon,
        })
    else:
        c.execute('''
            SELECT * FROM syntenic_block
            WHERE ref_taxonid=:ref_taxonid AND comp_taxonid=:comp_taxonid AND ref_chr=:ref_chr
            ORDER BY ref_start_pos
        ''', {
            'ref_taxonid': ref_taxon,
            'comp_taxonid': comp_taxon,
            'ref_chr': ref_chr,
        })

    if include_anchors:
        homologs = _get_homologs(ref_taxon, comp_taxon, ref_chr)
        curr_homolog = next(homologs, None)
        for row in c:
            curr_block = _dictify_row(c, row)
            match_anchor_points = dict()
            true_anchor_points = dict()

            ref_chr = curr_block['ref_chr']
            ref_end_pos = curr_block['ref_end_pos']
            ref_start_pos = curr_block['ref_start_pos']
            comp_end_pos = curr_block['comp_end_pos']
            comp_start_pos = curr_block['comp_start_pos']

            # fast forward through homologs until we hit the right chromosome
            while curr_homolog and curr_homolog['ref_chr'] != ref_chr:
                curr_homolog = next(homologs, None)

            # here we will keep adding anchor points from the homologs until we pass this block
            while curr_homolog and curr_homolog['ref_chr'] == ref_chr and curr_homolog['ref_start_pos'] < ref_end_pos:
                homolog_same_orientation = curr_homolog['ref_strand'] == curr_homolog['comp_strand']
                block_and_homolog_orientation_match = curr_block['same_orientation'] == homolog_same_orientation

                # we'll only add anchor points from a homolog if it is entirely within the bounds of the current block
                # and has the same orientation as the current block
                hom_ref_start_pos = curr_homolog['ref_start_pos']
                hom_ref_end_pos = curr_homolog['ref_end_pos']
                hom_comp_start_pos = curr_homolog['comp_start_pos']
                hom_comp_end_pos = curr_homolog['comp_end_pos']
                homolog_is_good_anchor = \
                    block_and_homolog_orientation_match and \
                    hom_ref_start_pos >= ref_start_pos and hom_ref_end_pos <= ref_end_pos and \
                    hom_comp_start_pos >= comp_start_pos and hom_comp_end_pos <= comp_end_pos
                if homolog_is_good_anchor:
                    if homolog_same_orientation:
                        match_anchor_points[hom_ref_start_pos] = hom_comp_start_pos
                        match_anchor_points[hom_ref_end_pos] = hom_comp_end_pos
                    else:
                        match_anchor_points[hom_ref_start_pos] = hom_comp_end_pos
                        match_anchor_points[hom_ref_end_pos] = hom_comp_start_pos

                    true_anchor_points[hom_ref_start_pos] = hom_comp_start_pos
                    true_anchor_points[hom_ref_end_pos] = hom_comp_end_pos

                curr_homolog = next(homologs, None)

            # we take the start and end anchors from the block start and end
            if curr_block['same_orientation']:
                match_anchor_points[ref_start_pos] = comp_start_pos
                match_anchor_points[ref_end_pos] = comp_end_pos
            else:
                match_anchor_points[ref_start_pos] = comp_end_pos
                match_anchor_points[ref_end_pos] = comp_start_pos

            true_anchor_points[ref_start_pos] = comp_start_pos
            true_anchor_points[ref_end_pos] = comp_end_pos

            match_anchor_point_tuples = sorted(((ref_anch, comp_anch) for ref_anch, comp_anch in
                                           match_anchor_points.items()))

            true_anchor_point_tuples = sorted(((ref_anch, comp_anch) for ref_anch, comp_anch in
                                                true_anchor_points.items()))

            match_ref_anchor_points, match_comp_anchor_points = zip(*match_anchor_point_tuples)
            true_ref_anchor_points, true_comp_anchor_points = zip(*true_anchor_point_tuples)

            curr_block['match_anchor_points'] = dict()
            curr_block['match_anchor_points']['ref_anchor_points'] = match_ref_anchor_points
            curr_block['match_anchor_points']['comp_anchor_points'] = match_comp_anchor_points

            curr_block['true_anchor_points'] = dict()
            curr_block['true_anchor_points']['ref_anchor_points'] = true_ref_anchor_points
            curr_block['true_anchor_points']['comp_anchor_points'] = true_comp_anchor_points

            yield curr_block
    else:
        for row in c:
            yield _dictify_row(c, row)


def get_genes(ref_taxonid, ref_chr):
    """
    Gets an iterable of reference genes overlapping with the given reference coordinate range
    :param ref_taxonid:     the NCBI taxonomy ID string for the reference
    :param ref_chr:         the chromosome for the reference coordinate range
    :return: an iterable of dictionaries (one per reference gene) sorted by start_pos. Each dictionary will contain the following attributes:

    * chr:              the chromosome string (this will always match ref_chr but is included for completeness)
    * start_pos:        the start position (base-pairs) of the gene
    * end_pos:          the integer end position (base-pairs) of the reference gene
    * strand:           the strand '+' or '-'
    * gene_id:          the unique identifier for this gene
    * gene_symbol:      the (possibly not unique) gene symbol
    * homologs:         a list of matching homologs and their data
    * canonical_transcript: (optional) if available the canonical transcript will be a list of dictionaries
                            (one per exon) sorted by start_pos. Each dictionary will contain:
        * start_pos: the exon start position in base pairs
        * end_pos: the exon end position in base pairs
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    c.execute('''
        SELECT *
        FROM
            (
                SELECT * FROM gene
                WHERE gene_chr=:ref_chr
            ) AS gene_interval
            INNER JOIN transcript ON transcript.gene_id = gene_interval.gene_id
            INNER JOIN exon ON exon.transcript_id = transcript.transcript_id
        WHERE
            gene_interval.gene_taxonid=:ref_taxonid AND transcript.is_canonical
        ORDER BY
            gene_start_pos, gene_id, transcript_id, exon_start_pos
    ''', {
        'ref_taxonid': ref_taxonid,
        'ref_chr': ref_chr,
    })

    curr_gene_id = None
    curr_gene = None
    for row in c:
        row_dict = _dictify_row(c, row)
        if row_dict['gene_id'] != curr_gene_id:
            if curr_gene is not None:
                yield curr_gene

            curr_gene_id = row_dict['gene_id']

            homologs_found = []
            h = db_con.cursor()
            symbol = (curr_gene_id,)
            # h.execute('SELECT * from homolog INNER JOIN gene on comp_gene_id = gene_id where ref_gene_id = ?', symbol)
            h.execute('''
                SELECT comp_seq_id AS gene_chr,
                    comp_end AS gene_end_pos,
                    comp_gene_id AS gene_id,
                    comp_start AS gene_start_pos,
                    comp_strand AS gene_strand,
                    comp_gene_sym AS gene_symbol,
                    comp_taxon_id AS gene_taxonid,
                    ref_gene_id,
                    ref_taxon_id AS ref_taxonid,
                    g.gene_type AS type
                    FROM homolog
                    INNER JOIN gene AS g ON comp_gene_id = g.gene_id
                    WHERE ref_gene_id = ?
            ''', symbol)

            for hrow in h:
                hrow_dict = _dictify_row(h, hrow)
                e = db_con.cursor()
                e.execute('''
                    SELECT exon_start_pos, exon_end_pos
                    FROM transcript
                    INNER JOIN exon ON exon.transcript_id = transcript.transcript_id
                    WHERE transcript.gene_id = ? AND transcript.is_canonical
                    ORDER BY exon_start_pos;
                ''', (hrow_dict["gene_id"], ))
                hrow_dict['canonical_transcript'] = []
                for erow in e:
                    erow_dict = _dictify_row(e, erow)
                    hrow_dict["canonical_transcript"].append({
                        'start_pos': erow_dict['exon_start_pos'],
                        'end_pos': erow_dict['exon_end_pos'],
                    })
                homologs_found.append(hrow_dict)


            curr_gene = {
                'start_pos': row_dict['gene_start_pos'],
                'end_pos': row_dict['gene_end_pos'],
                'strand': row_dict['gene_strand'],
                'gene_id': curr_gene_id,
                'gene_symbol': row_dict['gene_symbol'],
                'type': row_dict['gene_type'],
                'homologs': homologs_found,
                'canonical_transcript': [],
            }

        curr_gene['canonical_transcript'].append({
            'start_pos': row_dict['exon_start_pos'],
            'end_pos': row_dict['exon_end_pos'],
        })

    if curr_gene is not None:
        yield curr_gene


def get_species():
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    c.execute(
        """
        SELECT 
            DISTINCT(ref_taxonid) 
        FROM syntenic_block
        """
    )

    for row in c:
        yield _dictify_row(c, row)


def get_gene_metadata(taxon_id, gene_symbol=None):
    """
    :param taxon_id: id of the species this gene belongs to
    :param gene_symbol: unique gene symbol
    :return: all available database information about the gene
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    if gene_symbol is not None:
        c.execute(
            """
            SELECT 
                gene_id, 
                gene_symbol, 
                gene_type, 
                gene_chr AS chr,
                gene_strand AS strand,
                gene_start_pos AS start,
                gene_end_pos AS end   
            FROM gene
            WHERE gene.gene_taxonid=? AND gene_symbol LIKE ?
            ORDER BY gene_symbol ASC
            """, (taxon_id, gene_symbol + "%",)
        )
    else:
        c.execute(
            """
            SELECT 
                gene_id, 
                gene_symbol, 
                gene_type, 
                gene_chr AS chr,
                gene_strand AS strand,
                gene_start_pos AS start,
                gene_end_pos AS end   
            FROM gene
            WHERE gene.gene_taxonid=:ref_taxonid
            ORDER BY gene_symbol ASC
            """, {'ref_taxonid': taxon_id}
        )

    for row in c:
        yield _dictify_row(c, row)


def get_qtl_metadata(taxon_id, qtl_symbol=None):
    """
    :param taxon_id: id of the species this gene belongs to
    :param qtl_symbol: unique qtl symbol
    :return: all available database information about the gene
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    if qtl_symbol is not None:
        c.execute(
            """
            SELECT 
                id AS qtl_id,
                name AS qtl_symbol,
                seq_id AS chr,
                start,
                `end`
            FROM feature
            WHERE taxon_id = ? AND type = 'QTL' AND name LIKE ?
            ORDER BY name ASC
            """, (taxon_id, qtl_symbol + "%",)
        )
    else:
        c.execute(
            """
            SELECT 
                id AS qtl_id,
                name AS qtl_symbol,
                seq_id AS chr,
                start,
                `end`
            FROM feature
            WHERE taxon_id =:taxonid AND type = 'QTL'
            ORDER BY name ASC
            """, {'taxonid': taxon_id}
        )

    for row in c:
        yield _dictify_row(c, row)


def get_qtls_by_chr(taxon_id, chromosome):
    """

    :param taxon_id:
    :param chromosome:
    :return:
    """

    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    c.execute(
        """
        SELECT 
            id AS qtl_id,
            name AS qtl_symbol,
            seq_id AS chr,
            start,
            `end`
        FROM feature
        WHERE taxon_id = ? AND type = 'QTL' AND seq_id LIKE ?
        ORDER BY start ASC
        """, (taxon_id, chromosome,)
    )

    for row in c:
        yield _dictify_row(c, row)


def get_genome_blocks(ref_taxon, comp_taxon):
    """
    Get syntenic blocks between the given reference and comparison genomes
    :param ref_taxon:       the NCBI ID for the reference genome
    :param comp_taxon:      the NCBI ID for the comparison genome
    :return:    this function returns an iterable of dictionaries (one dictionary per block) sorted by reference chromosome
                and start position. Each dictionary will include the following properties:

    * ref_chr:      the reference block's chromosome
    * ref_start:    the reference block's start position (base pairs)
    * ref_end:      the reference block's end position (base pairs)

    * comp_chr:     the comparison block's chromosome
    * comp_start:   the comparison block's start position (base pairs)
    * comp_end:     the comparison block's end position (base pairs)

    * id: the synteny block id
    """

    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    c.execute(
        """
        SELECT 
            ref_chr,
            ref_start_pos AS ref_start,
            ref_end_pos AS ref_end,
            comp_chr,
            comp_start_pos AS comp_start,
            comp_end_pos AS comp_end,
            symbol AS id
        FROM syntenic_block
        WHERE ref_taxonid=:ref_taxonid AND comp_taxonid=:comp_taxonid
        ORDER BY ref_chr, ref_start_pos
        """, {'ref_taxonid': ref_taxon, 'comp_taxonid': comp_taxon}
    )

    for row in c:
        yield _dictify_row(c, row)


def get_chromosome_blocks(ref_taxon, comp_taxon, chr):
    """
        Get syntenic blocks between the given reference and comparison genomes
        :param ref_taxon:   the NCBI ID for the reference genome
        :param comp_taxon:  the NCBI ID for the comparison genome
        :param chr:         the chromsome value to get blocks for
        :return:    this function returns an iterable of dictionaries (one dictionary per block)
                    sorted by start position. Each dictionary will include the following properties:

        * ref_chr:      the reference block's chromosome
        * ref_start:    the reference block's start position (base pairs)
        * ref_end:      the reference block's end position (base pairs)

        * comp_chr:     the comparison block's chromosome
        * comp_start:   the comparison block's start position (base pairs)
        * comp_end:     the comparison block's end position (base pairs)

        * id: the synteny block id
        """

    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    c.execute(
        """
        SELECT 
            ref_chr,
            ref_start_pos AS ref_start,
            ref_end_pos AS ref_end,
            comp_chr,
            comp_start_pos AS comp_start,
            comp_end_pos AS comp_end,
            symbol AS id,
            same_orientation AS orientation_matches
        FROM syntenic_block
        WHERE ref_taxonid=:ref_taxonid AND comp_taxonid=:comp_taxonid AND ref_chr=:chr
        ORDER BY ref_start_pos
        """, {'ref_taxonid': ref_taxon, 'comp_taxonid': comp_taxon, 'chr': chr}
    )

    for row in c:
        row_dict = _dictify_row(c, row)
        if row_dict['orientation_matches'] == 0:
            row_dict['orientation_matches'] = False
        else:
            row_dict['orientation_matches'] = True
        yield row_dict


def get_chr_genes(ref_taxonid, comp_taxonid, ref_chr):
    """
    Gets an iterable of reference genes overlapping with the given reference coordinate range
    :param ref_taxonid:     the NCBI taxonomy ID string for the reference
    :param ref_chr:         the chromosome for the reference coordinate range
    :return: an iterable of dictionaries (one per reference gene) sorted by start_pos. Each dictionary will contain the following attributes:

    * chr:              the chromosome string (this will always match ref_chr but is included for completeness)
    * start_pos:        the start position (base-pairs) of the gene
    * end_pos:          the integer end position (base-pairs) of the reference gene
    * strand:           the strand '+' or '-'
    * gene_id:          the unique identifier for this gene
    * gene_symbol:      the (possibly not unique) gene symbol
    * homologs:         a list of matching homologs and their data
    * canonical_transcript: (optional) if available the canonical transcript will be a list of dictionaries
                            (one per exon) sorted by start_pos. Each dictionary will contain:
        * start_pos: the exon start position in base pairs
        * end_pos: the exon end position in base pairs
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    c.execute('''
        SELECT *
        FROM
            (
                SELECT * FROM gene
                WHERE gene_chr=:ref_chr
            ) AS gene_interval
            INNER JOIN transcript ON transcript.gene_id = gene_interval.gene_id
            INNER JOIN exon ON exon.transcript_id = transcript.transcript_id
        WHERE
            gene_interval.gene_taxonid=:ref_taxonid AND transcript.is_canonical
        ORDER BY
            gene_start_pos, gene_id, transcript_id, exon_start_pos
    ''', {
        'ref_taxonid': ref_taxonid,
        'ref_chr': ref_chr,
    })

    curr_gene_id = None
    curr_gene = None
    for row in c:
        row_dict = _dictify_row(c, row)
        if row_dict['gene_id'] != curr_gene_id:
            if curr_gene is not None:
                yield curr_gene

            curr_gene_id = row_dict['gene_id']

            homologs_found = []
            h = db_con.cursor()
            # h.execute('SELECT * from homolog INNER JOIN gene on comp_gene_id = gene_id where ref_gene_id = ?', symbol)
            h.execute('''
                SELECT comp_seq_id AS gene_chr,
                    comp_end AS gene_end_pos,
                    comp_gene_id AS gene_id,
                    comp_start AS gene_start_pos,
                    comp_strand AS gene_strand,
                    comp_gene_sym AS gene_symbol,
                    comp_taxon_id AS gene_taxonid,
                    ref_gene_id,
                    ref_taxon_id AS ref_taxonid,
                    g.gene_type AS type
                    FROM homolog
                    INNER JOIN gene AS g ON comp_gene_id = g.gene_id
                    WHERE ref_gene_id=:ref_gene_id AND comp_taxon_id=:comp_taxon_id
            ''', {
                'ref_gene_id': curr_gene_id,
                'comp_taxon_id': comp_taxonid
            })

            for hrow in h:
                hrow_dict = _dictify_row(h, hrow)
                e = db_con.cursor()
                e.execute('''
                    SELECT exon_start_pos, exon_end_pos
                    FROM transcript
                    INNER JOIN exon ON exon.transcript_id = transcript.transcript_id
                    WHERE transcript.gene_id = ? AND transcript.is_canonical
                    ORDER BY exon_start_pos;
                ''', (hrow_dict["gene_id"], ))
                hrow_dict['canonical_transcript'] = []
                for erow in e:
                    erow_dict = _dictify_row(e, erow)
                    hrow_dict["canonical_transcript"].append({
                        'start': erow_dict['exon_start_pos'],
                        'end': erow_dict['exon_end_pos'],
                    })
                homologs_found.append(hrow_dict)


            curr_gene = {
                'start': row_dict['gene_start_pos'],
                'end': row_dict['gene_end_pos'],
                'strand': row_dict['gene_strand'],
                'gene_id': curr_gene_id,
                'gene_symbol': row_dict['gene_symbol'],
                'type': row_dict['gene_type'],
                'homologs': homologs_found,
                'canonical_transcript': [],
            }

        curr_gene['canonical_transcript'].append({
            'start': row_dict['exon_start_pos'],
            'end': row_dict['exon_end_pos'],
        })

    if curr_gene is not None:
        yield curr_gene


def get_gene_info(taxon_id, gene_symbol):
    """
    :param taxon_id: id of the species this gene belongs to
    :param gene_symbol: unique gene symbol
    :return: all available database information about the gene
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()
    
    c.execute(
        '''
        SELECT * 
        FROM gene
            WHERE gene.gene_taxonid=? AND gene_symbol LIKE ?
            ORDER BY gene_symbol ASC
        ''', (taxon_id, gene_symbol + "%",)
    )
    
    for row in c:
        row_dict = _dictify_row(c, row)
        curr_gene_id = row_dict['gene_id']
        # need to deal with homologs here
        homologs_found = []
        h = db_con.cursor()
        h.execute(
            '''
            SELECT comp_gene_id AS gene_id,
                comp_seq_id AS gene_chr,
                comp_gene_sym AS gene_symbol,
                comp_taxon_id AS gene_taxonid,
                comp_start AS gene_start_pos,
                comp_end AS gene_end_pos,
                comp_strand AS gene_strand,
                ref_gene_id,
                ref_taxon_id AS ref_taxonid
            FROM homolog
                WHERE ref_gene_id = ?
            ''', (curr_gene_id,)
        )

        for hrow in h:
            hrow_dict = _dictify_row(h, hrow)
            # del hrow_dict['comp_gene_id']
            # del hrow_dict['comp_taxon_id']
            homologs_found.append(hrow_dict)
        row_dict['homologs'] = homologs_found
        yield row_dict


def get_qtl_info(taxon_id, name):
    """
    :param taxon_id:
    :param name
    :return: more detailed information about this feature
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()

    symbol = (taxon_id, name + "%",)
    c.execute("""SELECT * FROM feature
                               WHERE taxon_id = ?
                                   AND type = 'QTL'
                                   AND name LIKE ?
                               ORDER BY name ASC""", symbol)

    for row in c:
        yield _dictify_row(c, row)


def get_species_genes_labeled_with_term(taxon_id, ont_id, ont_term):
    """
        Finds information about genes associated with the given ontology term.

        :param: taxon_id: NCBI taxonomy id (i.e. 9606, 10090, ...)
        :param: ont_id: ontology abbreviation symbol (i.e. MP, DO, GO, ...)
        :param: ont_term: gene ontology term
        :return: a list of dictionaries each containing information about an ontology term - gene pair
        """
    db_conn = sqlite3.connect(DB_PATH)

    cursor = db_conn.cursor()
    search_symbols = (taxon_id, ont_id + ":%", "%" + ont_term + "%", "%" + ont_term + "%")

    cursor.execute(
        '''
            SELECT DISTINCT ot.id, ot.name
            FROM on_terms AS ot
                INNER JOIN gene_ontology_map as otm
                    ON id = ontology_id  
            WHERE otm.taxonid = ? 
                AND ot.id LIKE ? 
                AND (ot.id LIKE ? OR ot.name LIKE ?) 
        ''', search_symbols
    )

    parent_terms = []

    for row in cursor:
        parent_terms.append(row[0])

    n = len(parent_terms)

    for i in range(0, n):
        do_search(parent_terms[i], parent_terms, db_conn)

    unique_parents = list(set(parent_terms))

    if len(parent_terms) > 0:
        query_vals = [taxon_id]
        query_vals.extend(unique_parents)
        t = tuple(query_vals)

        cursor.execute(
            '''
                SELECT DISTINCT gom.ontology_id,
                    ot.name,
                    gene.gene_id,
                    gene.gene_chr,
                    gene.gene_taxonid,
                    gene.gene_start_pos,
                    gene.gene_end_pos,
                    gene.gene_strand,
                    gene.gene_symbol,
                    gene.gene_type 
                FROM gene 
                    INNER JOIN gene_ontology_map as gom 
                        ON (gene.gene_symbol = gom.gene_id OR gene.gene_id = gom.gene_id)
                    INNER JOIN on_terms as ot 
                        ON gom.ontology_id = ot.id
                    WHERE gene.gene_taxonid = ?
                        AND gom.ontology_id IN ({seq})
            '''.format(seq=','.join(['?']*len(unique_parents))), t
        )

        genes = []

        for row in cursor:
            genes.append(_dictify_row(cursor, row))

        return genes
    else:
        return []


def get_genes_labeled_with_term(ont_id, ont_term):
    """
    Finds information about genes associated with the given ontology term.

    :param: ont_id: ontology abbreviation symbol (i.e. MP, DO, GO, ...)
    :param: ont_term: gene ontology term
    :return: a list of dictionaries each containing information about an ontology term - gene pair
    """
    db_conn = sqlite3.connect(DB_PATH)

    cursor = db_conn.cursor()
    search_symbols = (ont_id + ":%", "%" + ont_term + "%", "%" + ont_term + "%")

    cursor.execute(
        '''
            SELECT DISTINCT ot.id, ot.name
            FROM on_terms AS ot
                INNER JOIN gene_ontology_map as otm
                    ON id = ontology_id  
            WHERE ot.id LIKE ? 
                AND (ot.id LIKE ? OR ot.name LIKE ?) 
        ''', search_symbols
    )

    parent_terms = []

    for row in cursor:
        parent_terms.append(row[0])

    n = len(parent_terms)

    for i in range(0, n):
        do_search(parent_terms[i], parent_terms, db_conn)

    unique_parents = list(set(parent_terms))

    if len(parent_terms) > 0:
        query_vals = unique_parents
        t = tuple(query_vals)

        cursor.execute(
            '''
                SELECT DISTINCT gom.ontology_id,
                    ot.name,
                    gene.gene_id,
                    gene.gene_chr,
                    gene.gene_taxonid,
                    gene.gene_start_pos,
                    gene.gene_end_pos,
                    gene.gene_strand,
                    gene.gene_symbol,
                    gene.gene_type 
                FROM gene 
                    INNER JOIN gene_ontology_map as gom 
                        ON (gene.gene_symbol = gom.gene_id OR gene.gene_id = gom.gene_id)
                    INNER JOIN on_terms as ot 
                        ON gom.ontology_id = ot.id
                    WHERE gom.ontology_id IN ({seq})
            '''.format(seq=','.join(['?']*len(unique_parents))), t
        )

        genes = []

        for row in cursor:
            genes.append(_dictify_row(cursor, row))

        return genes
    else:
        return []


def get_gt_assoc_info(taxon_id, gene_list):
    """
    :param:
    :param:
    :return:
	"""
    db_conn = sqlite3.connect(DB_PATH)
    cursor = db_conn.cursor()
    gene_names = gene_list.split("|")
	
    cursor.execute(
        '''
            SELECT DISTINCT gene_type 
            FROM gene
                WHERE gene_symbol IN ({seq})
        '''.format(seq=','.join(['?']*len(gene_names))), gene_names
    )
	
    for row in cursor:
        yield _dictify_row(cursor, row)


def do_search(parent, parent_terms, db_conn):
    """
    Finds and adds the children of parent to the parent_terms list.

    :param parent: (ontology) term id
    :param parent_terms: list with all currently found (ontology) term ids 
    :param db_conn: SQLite connection object
    """
    cursor = db_conn.cursor()

    cursor.execute("SELECT child FROM on_pairs WHERE parent = ?", (parent,))
    current_terms = []

    row = cursor.fetchone()

    while row is not None:
        current_terms.append(row[0])    
        row = cursor.fetchone()
    cursor.close()

    for term in current_terms:
        parent_terms.append(term)
        do_search(term, parent_terms, db_conn)


def _get_homologs(ref_taxonid, comp_taxonid, ref_chr=None):
    """
    Get homologs between the given reference and comparison genomes
    :param ref_taxonid: the NCBI taxonomy ID string for the reference
    :param comp_taxonid: the NCBI taxonomy ID string for the comparison
    :param ref_chr: the chromosome string. like '1', '2', '3', ... or 'X'. If None, homologs from all
                    reference chromosomes will be returned
    :return: an iterable of dictionaries (one per homolog). Each dictionary will contain the following attributes:

    * ref_chr:          the reference chromosome string (if the ref_chr parameter is provided this will always
                        match that value)
    * ref_start_pos:    the integer start position (base-pairs) of the reference gene
    * ref_end_pos:      the integer end position (base-pairs) of the reference gene
    * ref_strand:       the reference strand '+' or '-'
    * comp_chr:         the comparison chromosome string
    * comp_start_pos:   the integer start position of the comparison gene
    * comp_end_pos:     the integer end position of the comparison gene
    * comp_strand:      the comparison strand '+' or '-'
    """
    db_con = sqlite3.connect(DB_PATH)
    c = db_con.cursor()
    if ref_chr is None:
        c.execute('''
            SELECT ref_gene_id, 
                ref_taxon_id AS ref_taxonid, 
                comp_gene_id, 
                comp_taxon_id AS comp_taxonid,
                ref_seq_id AS ref_chr,
                ref_start AS ref_start_pos,
                ref_end AS ref_end_pos,
                ref_strand,
                comp_seq_id AS comp_chr,
                comp_start AS comp_start_pos,
                comp_end AS comp_end_pos,
                comp_strand
            FROM homolog
            WHERE
                ref_taxonid=:ref_taxonid
                AND comp_taxonid=:comp_taxonid
            ORDER BY ref_chr, ref_start_pos
        ''', {
            'ref_taxonid': ref_taxonid,
            'comp_taxonid': comp_taxonid,
        })
    else:
        c.execute('''
            SELECT ref_gene_id, 
                ref_taxon_id AS ref_taxonid, 
                comp_gene_id, 
                comp_taxon_id AS comp_taxonid,
                ref_seq_id AS ref_chr,
                ref_start AS ref_start_pos,
                ref_end AS ref_end_pos,
                ref_strand,
                comp_seq_id AS comp_chr,
                comp_start AS comp_start_pos,
                comp_end AS comp_end_pos,
                comp_strand
            FROM homolog
            WHERE
                ref_taxonid=:ref_taxonid
                AND comp_taxonid=:comp_taxonid
                AND ref_chr=:ref_chr
            ORDER BY ref_start_pos
        ''', {
            'ref_taxonid': ref_taxonid,
            'comp_taxonid': comp_taxonid,
            'ref_chr': ref_chr,
        })

    for row in c:
        yield _dictify_row(c, row)


def main():
    # main function showing some example uses of the API
    pp = pprint.PrettyPrinter(width=180)

    # example use of get_blocks
    print("=== testing blocks 1 ===")
    tha_blocks=get_blocks(ref_chr=1, ref_taxon=9606, comp_taxon=10090)
    pp.pprint(list(tha_blocks))
    print("=== testing blocks 2 ===")
    tha_blocks=get_blocks(ref_chr=1, ref_taxon=10090, comp_taxon=9606)
    pp.pprint(list(tha_blocks))
    print("=== testing blocks 3 ===")
    tha_blocks=get_blocks(ref_taxon=9606, comp_taxon=10090)
    pp.pprint(list(tha_blocks))
    print("=== testing blocks 4 ===")
    tha_blocks=get_blocks(ref_chr=1, ref_taxon=9606, comp_taxon=10090, include_anchors=True)
    pp.pprint(list(tha_blocks))
    print("=== testing blocks 5 ===")
    tha_blocks=get_blocks(ref_taxon=9606, comp_taxon=10090, include_anchors=True)
    pp.pprint(list(tha_blocks))
    print("=== testing blocks 6 ===")
    tha_blocks=get_gene_symbols("10090", "gm")
    pp.pprint(list(tha_blocks))


if __name__ == '__main__':
    main()
