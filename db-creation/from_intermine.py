#! /usr/bin/env python3

"""
Import data from mousemine.  This can get human and mouse data; other importers
will be needed to import data for other genomes. It is likely that those will be
genome-specific, so are not accommodated here.

This program creates and populates database tables:
 - gene
 - transcript
 - exon
 - homolog
 - syntenic_block

Data for homology, synteny and genes come from mousemine.
Data for transcripts and exons come from local gff3 files.
"""
from itertools import permutations
from intermine.webservice import Service
import sys
import argparse
import sqlite3
from flex_open import flex_open
import csv

COLUMN_MAPPING = {
    'homolog': {
        'type': 'Type',
        # Reference data
        'gene.organism.taxonId': 'TaxonID1',
        'gene.primaryIdentifier': 'ID1',
        'gene.symbol': 'Symbol1',
        'gene.chromosome.primaryIdentifier': 'SeqID1',
        'gene.chromosomeLocation.start': 'Start1',
        'gene.chromosomeLocation.end': 'End1',
        'gene.chromosomeLocation.strand': 'Strand1',
        # Comparison data
        'homologue.organism.taxonId': 'TaxonID2',
        'homologue.primaryIdentifier': 'ID2',
        'homologue.symbol': 'Symbol2',
        'homologue.chromosome.primaryIdentifier': 'SeqID2',
        'homologue.chromosomeLocation.start': 'Start2',
        'homologue.chromosomeLocation.end': 'End2',
        'homologue.chromosomeLocation.strand': 'Strand2',
    }
}

FILE_HEADERS = {
    # Dicts are inherently unordered, so we use a list to store the headers.
    'homolog': [
        'Type',
        # Ref headers
        'TaxonID1',
        'ID1',
        'Symbol1',
        'SeqID1',
        'Start1',
        'End1',
        'Strand1',
        # Comparison headers
        'TaxonID2',
        'ID2',
        'Symbol2',
        'SeqID2',
        'Start2',
        'End2',
        'Strand2',
    ]
}


def parse_args():
    # parse command line arguments
    parser = argparse.ArgumentParser(
        description="import intermine data into a sqlite3 database")
    parser.add_argument(
        'synteny_db',
        help="the SQLite3 DB file that will be created or updated")
    parser.add_argument(
        '--human-features',
        default='data-scripts/source-data/NCBI_Human_forSynteny.gff3.gz',
        help="gff3 file containing human mRNA and exon annotations")
    parser.add_argument(
        '--mouse-features',
        default='data-scripts/source-data/MGI_GenomeFeature_forSynteny.gff3.gz',
        help="gff3 file containing mouse mRNA and exon annotations")
    parser.add_argument(
        '--output_file', default=None,
        help="Instead of loading a database, write the output to a plain text "
             "file with this name (path).\n"
             "Currently only implemented for homologs."
        )
    args = parser.parse_args()
    return args


def create_tables(db_con):
    c = db_con.cursor()

    c.execute('''DROP TABLE IF EXISTS gene''')
    c.execute('''
        CREATE TABLE gene (
            gene_id TEXT,
            gene_taxonid INTEGER,
            gene_symbol TEXT,
            gene_chr TEXT,
            gene_start_pos INTEGER,
            gene_end_pos INTEGER,
            gene_strand TEXT,
            gene_type TEXT,
            PRIMARY KEY (gene_id, gene_taxonid)
        )
    ''')
    c.execute('''CREATE INDEX gene_start_pos_idx ON gene (gene_taxonid, gene_chr, gene_start_pos)''')
    c.execute('''CREATE INDEX gene_end_pos_idx ON gene (gene_taxonid, gene_chr, gene_end_pos)''')
    c.execute('''CREATE INDEX gene_id_idx ON gene(gene_id)''')
    c.execute('''CREATE INDEX gene_pos_idx ON gene (gene_chr, gene_start_pos, gene_end_pos)''')
    c.execute('''CREATE INDEX gene_taxonid_symbol_idx ON gene(gene_taxonid, gene_symbol, gene_chr, gene_type)''')

    c.execute('''DROP TABLE IF EXISTS transcript''')
    # FIXME This doesn't match the current definition.
    c.execute('''
        CREATE TABLE transcript (
            transcript_id TEXT,
            chr TEXT,
            start INTEGER,
            end INTEGER,
            strand TEXT,
            gene_id TEXT,
            gene_type TEXT,
            taxonid INTEGER,
            status TEXT,
            dbxref TEXT,
            is_canonical BOOLEAN,
            source TEXT,
            PRIMARY KEY (transcript_id, taxonid)
        )
    ''')
    c.execute('''CREATE INDEX transcript_idx ON transcript (gene_id, is_canonical, taxonid)''')

    c.execute('''DROP TABLE IF EXISTS exon''')
    c.execute('''
        CREATE TABLE exon (
            transcript_id TEXT,
            taxonid INTEGER,
            exon_chr TEXT,
            exon_start_pos INTEGER,
            exon_end_pos INTEGER
        )
    ''')
    c.execute('''CREATE INDEX exon_idx ON exon (transcript_id)''')

    c.execute('''DROP TABLE IF EXISTS feature_alias''')
    c.execute('''
        CREATE TABLE feature_alias (
            alias TEXT,
            taxonid INTEGER,
            id TEXT
        )
    ''')
    c.execute('''CREATE INDEX alias_alias_idx on feature_alias(alias)''')
    c.execute('''CREATE INDEX alias_id_idx on feature_alias(id)''')

    c.execute('''DROP TABLE IF EXISTS homolog''')
    c.execute('''
        CREATE TABLE homolog (
            ref_gene_id TEXT,
            ref_gene_sym TEXT,
            ref_taxon_id INTEGER,
            ref_seq_id TEXT,
            ref_start INTEGER,
            ref_end INTEGER,
            ref_strand TEXT,
            comp_gene_id TEXT,
            comp_gene_sym TEXT,
            comp_taxon_id INTEGER,
            comp_seq_id TEXT,
            comp_start INTEGER,
            comp_end INTEGER,
            comp_strand TEXT,
            PRIMARY KEY (ref_gene_id, ref_taxon_id, comp_gene_id, comp_taxon_id)
        )
    ''')
    c.execute('''CREATE INDEX homolog_comp_gene_id_idx ON homolog(comp_gene_id, ref_gene_id)''')
    c.execute('''CREATE INDEX homolog_ref_taxon_gene_idx ON homolog(ref_taxon_id, ref_gene_id)''')
    c.execute('''CREATE INDEX homolog_comp_taxon_gene_idx ON homolog(comp_taxon_id, comp_gene_id)''')
    c.execute('''CREATE INDEX homolog_ref_chr_idx ON homolog(ref_seq_id)''')

    c.execute('''DROP TABLE IF EXISTS syntenic_block''')
    c.execute('''
        CREATE TABLE syntenic_block (
            ref_taxonid INTEGER,
            ref_chr TEXT,
            ref_start_pos INTEGER,
            ref_end_pos INTEGER,
            comp_taxonid INTEGER,
            comp_chr TEXT,
            comp_start_pos INTEGER,
            comp_end_pos INTEGER,
            same_orientation BOOLEAN,
            symbol TEXT,
            PRIMARY KEY (ref_taxonid, comp_taxonid, ref_chr, ref_start_pos))
    ''')
    c.execute('''CREATE INDEX syntenic_taxons_ref_idx ON
                  syntenic_block (ref_taxonid, comp_taxonid, ref_chr)''')

    db_con.commit()

def import_genes(service, db_con):
    c = db_con.cursor()

    query = service.new_query('Gene')

    # The view specifies the output columns
    query.add_view(
        'primaryIdentifier',
        'symbol',
        'mgiType',
        'organism.taxonId',
        'chromosome.primaryIdentifier',
        'chromosomeLocation.start',
        'chromosomeLocation.end',
        'chromosomeLocation.strand',
    )

    query.add_constraint('organism.taxonId', 'ONE OF',
                         ['10090', '9606'], code='A')
    for row in query.rows():
        c.execute(
            '''INSERT INTO gene (gene_id, gene_taxonid, gene_symbol,
                                 gene_chr, gene_start_pos, gene_end_pos,
                                 gene_strand, gene_type)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)''',
            (
                row['primaryIdentifier'],
                int(row['organism.taxonId']),
                row['symbol'],
                row['chromosome.primaryIdentifier'],
                int(row['chromosomeLocation.start']),
                int(row['chromosomeLocation.end']),
                row['chromosomeLocation.strand'],
                row['mgiType'],
            )
        )




def get_headers(which):
    return FILE_HEADERS[which]


def map_header_names(input_dict, which):
    output_dict = {}
    mapping_dict = COLUMN_MAPPING[which]
    # Make sure we have at least all our desired data by using the mapping
    # table as our definitive list of keys.
    for k in mapping_dict:
        output_dict[mapping_dict[k]] = input_dict[k]
    return output_dict


def import_homologs(service, db_con, output_file):
    """
    Import homologs from Intermine.  Either load them into a database table,
    or create a file in the order expected by the file homolog importer.
    :param service: The intermine service connection.
    :param db_con: The connection to the database.
    :param output_file: Create a TSV file instead of loading the database.
    :return: None
    """
    c = db_con.cursor()

    query = service.new_query('Homologue')
    query.add_view(
        'type',
        'gene.primaryIdentifier',
        'gene.symbol',
        'gene.organism.name',
        'gene.organism.taxonId',
        'gene.chromosome.primaryIdentifier',
        'gene.chromosomeLocation.start',
        'gene.chromosomeLocation.end',
        'gene.chromosomeLocation.strand',
        'homologue.primaryIdentifier',
        'homologue.symbol',
        'homologue.organism.name',
        'homologue.organism.taxonId',
        'homologue.chromosome.primaryIdentifier',
        'homologue.chromosomeLocation.start',
        'homologue.chromosomeLocation.end',
        'homologue.chromosomeLocation.strand',
    )

    query.add_constraint('gene.organism.name', '=', 'Homo sapiens', code='A')
    query.add_constraint('homologue.organism.name', '=', 'Mus musculus',
                         code='B')
    query.add_constraint('type', '=', 'orthologue', code='C')

    if output_file:
        of = open(output_file, 'w')
        # Put out a ## to comment the header line.
        print('##', file=of, end='')
        seen_rows = set()

        # Write the rest of the file with a DictWriter. Wonderful tool.
        writer = csv.DictWriter(of, fieldnames=get_headers('homolog'),
                                delimiter='\t')
        writer.writeheader()
        for row in query.rows():
            row = map_header_names(row, 'homolog')
            # For some reason, mousemine is returning us duplicate
            # ortholog rows.  Filter them out.
            # A dict isn't hashable; change it to a string.
            row_as_str = ''.join([str(x) for x in row.values()])
            if row_as_str in seen_rows:
                print("Skipping:", row_as_str)
                continue
            seen_rows.add(row_as_str)
            writer.writerow(row)
        of.close()
    else:
        sql_query = '''INSERT OR IGNORE INTO homolog (
                     ref_gene_id,
                     ref_gene_sym,
                     ref_gene_taxon_id,
                     ref_gene_seq_id,
                     ref_gene_start,
                     ref_gene_end,
                     ref_gene_strand,
                     comp_gene_id,
                     comp_gene_sym,
                     comp_gene_taxon_id,
                     comp_gene_seq_id,
                     comp_gene_start,
                     comp_gene_end,
                     comp_gene_strand,
                     )
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'''

        for row in query.rows():
            ref_taxid = int(row['gene.organism.taxonId'])
            comp_taxid = int(row['homologue.organism.taxonId'])
            # How would these ever be equal???
            if ref_taxid != comp_taxid:
                ref_params = (
                    row['gene.primaryIdentifier'],
                    row['gene.symbol'],
                    ref_taxid,
                    row['gene.chromosome.primaryIdentifier'],
                    int(row['gene.chromosomeLocation.start']),
                    int(row['gene.chromosomeLocation.end']),
                    row['gene.chromosomeLocation.strand'],
                )
                comp_params = (
                    row['homologue.primaryIdentifier'],
                    row['homologue.symbol'],
                    comp_taxid,
                    row['homologue.chromosome.primaryIdentifier'],
                    int(row['homologue.chromosomeLocation.start']),
                    int(row['homologue.chromosomeLocation.end']),
                    row['homologue.chromosomeLocation.strand'],
                )
                # The intermine query only returns homologs in one direction;
                # so we insert them in both directions.
                c.execute(sql_query, ref_params + comp_params)
                c.execute(sql_query, comp_params + ref_params)


def import_syntenic_blocks(service, db_con):
    """
    Load the database with syntenic blocks. MouseMine has changed its syntenic
    block query format. Results are now returned with one row per species, and
    need to be combined based on SB symbol.  We do that mapping, and then
    insert the synteny in the table in both directions (taxon 1 being ref and
    then taxon 2 being ref).
    :param service: The mousemine service URL
    :param db_con: The connection to the database
    :return: None
    """
    c = db_con.cursor()

    # Get a new query on the class (table) you will be querying:
    query = service.new_query('SyntenicRegion')

    query.add_view(
        'organism.taxonId', 'chromosomeLocation.start',
        'chromosomeLocation.end', 'symbol',
        'chromosome.name', 'orientation'
    )
    query.add_sort_order('SyntenicRegion.name', 'ASC')

    # Have to go through a merging step to map the two rows together.
    # Create a dictionary to be keyed by SB symbol
    blocks = {}

    for row in query.rows():
        same_orientation = row['orientation'] == '+'
        chromosome = row['chromosome.name'].replace(
            'Chromosome ', ''
        ).replace(
            'chr', ''
        ).replace(
            ' (human)', ''
        ).replace(
            ' (mouse)', ''
        )
        try:
            block = blocks[row['symbol']]
        except KeyError:
            # A dictionary keyed by taxon ID
            block = {}
            blocks[row['symbol']] = block

        # These two data are the same for both instances of rows with this
        # syntenic block symbol.
        block['orientation'] = same_orientation
        block['symbol'] = row['symbol']
        block[row['organism.taxonId']] = {
            'chr': chromosome,
            'start': row['chromosomeLocation.start'],
            'end': row['chromosomeLocation.end'],
        }

    # Now load the database:
    for block_name in sorted(blocks.keys()):
        block = blocks[block_name]
        taxons = list(block.keys())
        taxons.remove('symbol')
        taxons.remove('orientation')

        # Here in our for loop, we use [0, 1], but we don't use those as indexes.
        # We just need to execute this loop twice.  We're going to insert this
        # block twice, once with the first taxon as the ref, and the second with
        # the second taxon as the ref.  We do this magic by reversing the taxons
        # list at the bottom of this loop.
        for n in (0, 1):
            ref_name = taxons[0]
            ref = block[ref_name]
            comp_name = taxons[1]
            comp = block[comp_name]

            # removes any 'chr' string, converts resulting value to integer and then
            # back to string to get rid of any padding zeroes
            try:
                ref['chr'] = str(int(ref['chr']))
            except:
                pass

            try:
                comp['chr'] = str(int(comp['chr']))
            except:
                pass

            c.execute(
                '''INSERT INTO syntenic_block (
                        ref_taxonid, ref_chr, ref_start_pos, ref_end_pos,
                        comp_taxonid, comp_chr, comp_start_pos, comp_end_pos,
                        same_orientation, symbol
                        )
                      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)''',
                (ref_name, ref['chr'], ref['start'], ref['end'],
                 comp_name, comp['chr'], comp['start'], comp['end'],
                 block['orientation'],
                 block['symbol'])
            )
            if n == 0:
                taxons.reverse()


def import_gff_annotations(gff, taxonid, db_con):
    """
    Import transcripts (called mRNAs) and exons into the database from a
    gff3 file. This is a tab-separated file with columns:

    - chr
    - source
    - type (mRNA or exon)
    - start
    - end
    - score (not used in the files we've seen so far)
    - strand
    - phase (not used in the files we've seen so far)
    - a semicolon-separated list of
      - for mRNAs
        - ID
        - Name
        - Alias(es) can be several
        - Dbxref
        - Gene type
        - Status (mouse only?)
      - for exons
        - Parent
        - Status (mouse only?)

    :param gff:
    :param taxonid:
    :param db_con:
    :return:
    """

    def gff_error(msg):
        print("ERROR at {0} line {1} {2} in line:\n    {3}".format(
            gff, line_no, msg, line
        ), file=sys.stderr)

    c = db_con.cursor()

    for line_no, line in enumerate(flex_open(gff)):
        # Skip comment lines
        if line.strip().startswith('#'):
            continue

        # Commented assignments are retained for documentation only
        parts = line.split('\t')
        chr = parts[0].replace('chr', '')
        source = parts[1]
        # type = parts[2]
        start = parts[3]
        end = parts[4]
        # score = parts[5]  # We ignore
        strand = parts[6]
        # phase = parts[7]  # We ignore
        col9 = parts[8]

        # Split col9 into its component parts
        d = {'Alias': []}

        for attrib in col9.split(';'):
            k, v = [x.strip() for x in attrib.split('=')]
            if k == 'Alias':
                d[k].append(v)
            else:
                d[k] = v

        # Put the feature in the DB
        # We'll handle aliases later.
        if 'ID=' in col9:
            # Transcript (-like) fields
            try:
                id = d['ID']
                dbxref = d['Dbxref']
                # Use dbxref if the name if the name is blank
                name = d.get('Name', dbxref)  # Not always present

                # Clean up the gene names to be the same format as in the gene
                # table.
                #  NOTE WELL!  THIS PART IS SPECIFIC TO HUMAN AND MOUSE GENE
                #  NAMES.
                if taxonid == 10090:  # Mouse
                    name = name.replace('MGI_', 'MGI:')
                    name = name.split('_')[0]
                elif taxonid == 9606:  # Human
                    name = name.replace('GeneID:', '')

                gene_type = d.get('Gene_Type', None)
                status = d.get('Status', None)
            except KeyError as e:
                gff_error(e)

            try:
                c.execute('''
                    INSERT INTO transcript (
                        transcript_id, chr, start, end, strand, gene_id, gene_type,
                        taxonid, status, dbxref, is_canonical, source)
                        VALUES (
                            ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
                        )
                ''', (id, chr, start, end, strand, name, gene_type, taxonid, status,
                      dbxref, True, source
                     )
                )
            except sqlite3.IntegrityError as e:
                gff_error(e)
                continue

            # Transcripts have aliases; exons don't. Handle them here.
            for alias in d['Alias']:
                # Don't record identity here. It isn't always present, and
                # we always want it, so we do it explicitly below.
                if id != alias and alias != '???':
                    try:
                        c.execute('''INSERT INTO feature_alias (alias, id)
                            VALUES(?, ?)
                        ''', (alias, id)
                        )
                    except sqlite3.IntegrityError:
                        gff_error("Duplicate alias detected: {0}".format(alias))
                        continue
            # Record the ID as its own alias, so that we can always do a lookup
            # in the feature_alias table
            try:
                c.execute('''INSERT INTO feature_alias (alias, id)
                    VALUES(?, ?)
                ''', (id, id)
                )
            except sqlite3.IntegrityError:
                gff_error("Duplicate alias detected: {0}".format(alias))
        elif 'Parent' in col9:
            # Handling exons here.
            try:
                parent = d['Parent']
            except:
                gff_error("Exon is missing parent field on line")
                continue
            status = d.get('Status', None)
            #
            # Used to load "source" and "status", but skipping them now.
            c.execute('''
                INSERT INTO exon (
                    transcript_id, taxonid, exon_chr, exon_start_pos,
                    exon_end_pos)
                    VALUES (
                        ?, ?, ?, ?, ?
                    )
            ''', (parent, taxonid, chr, start, end))
        else:
            gff_error("Not transcript or exon?")
            # Protect against adding more code later...
            continue


def main():
    args = parse_args()

    service = Service('http://www.mousemine.org/mousemine/service')
    db_con = sqlite3.connect(args.synteny_db)

    # FIXME: Reenable all the disabled steps!

    print("Creating tables.")
    create_tables(db_con)

    print("Importing syntenic blocks.")
    import_syntenic_blocks(service, db_con)

    print("Importing genes")
    import_genes(service, db_con)

    # Currently loading from a file, not intermine.
    # print("Importing homologs")
    # import_homologs(service, db_con, args.output_file)

    print("Importing mouse features into transcripts and exons tables")
    import_gff_annotations(args.mouse_features, 10090, db_con)
    db_con.commit()

    print("Importing human features into transcripts and exons tables")
    import_gff_annotations(args.human_features, 9606, db_con)
    db_con.commit()


if __name__ == '__main__':
    main()
