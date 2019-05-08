#! /usr/bin/env python3

"""
Imports features from gff3 files, to allow searching by feature name / ID.
"""
import argparse
import sqlite3
import sys

from flex_open import flex_open

"""
Load an arbitrary gff3 file into the feature and alias tables.
"""

def parse_args():
    parser = argparse.ArgumentParser()
    parser.add_argument('database',
                        help='Path to the database to load')
    parser.add_argument('filepath',
                        help='Path to the gff3 file to load.')
    parser.add_argument('taxonid',
                        help='Taxon ID for the features being loaded.')
    parser.add_argument('-c', '--create', action='store_true',
                        help='Creates new database tables (after dropping any pre-existing tables).')
    args = parser.parse_args()
    return args


def create_tables(db_con):
    """
    Create the feature and alias tables, dropping any existing tables first.
    :param db_con: A connection to an sqlite3 database.
    :return: None
    """
    cur = db_con.cursor()

    cur.execute('''DROP TABLE IF EXISTS feature_alias''')
    cur.execute('''CREATE TABLE feature_alias (
          alias TEXT,
          taxon_id INTEGER,
          id TEXT
        )''')
    cur.execute('''CREATE INDEX alias_alias_idx on feature_alias(alias)''')
    cur.execute('''CREATE INDEX alias_id_idx on feature_alias(id)''')

    cur.execute('''DROP TABLE IF EXISTS feature''')
    cur.execute('''CREATE TABLE feature (
            taxon_id INTEGER NOT NULL,
            seq_id TEXT NOT NULL,
            source TEXT NOT NULL,
            type TEXT NOT NULL,
            start INTEGER NOT NULL,
            end INTEGER NOT NULL,
            score REAL,
            strand TEXT,
            phase INTEGER,
            id TEXT,
            name TEXT,
            dbxref TEXT,
            bio_type TEXT,
            status TEXT,
            parent TEXT,
         PRIMARY KEY (source, taxon_id, id, dbxref)
        )''')
    cur.execute('''CREATE INDEX feature_taxonid_name_idx ON
                    feature(taxon_id, type, name)''')
    db_con.commit()


def load_file(db_con, filepath, taxon_id):
    """
    Load a set of features from a GFF3-format file.
    The file format is specified in http://gmod.org/wiki/GFF3.
    :param db_con: a conection to an sqlite3 database.
    :param filepath: The path to the file to be loaded.
    :param taxon_id: The taxon ID for the features we are loading.
    :return: None
    """
    gff = flex_open(filepath)
    first_line = gff.readline()
    if not first_line.strip().endswith('gff-version 3'):
        print("Input file must be a properly-formatted GFF3 file.\n"
              "Expected the first line to be '#gff-version 3'")
        sys.exit("Please try again.")

    # Now process all the data rows.  Column order is specified by the gff3
    # spec: http://gmod.org/wiki/GFF3
    columns = ['seq_id',
               'source',
               'type',
               'start',
               'end',
               'score',
               'strand',
               'phase',
               'attributes']

    # GFF allows other attributes, but these are the ones we're interested in.
    # We are also interested in aliases, but we'll handle those separately
    # because there can be many for a single feature.
    attribute_names = ['ID',
                       'Name',
                       'Dbxref',
                       'bioType',
                       'Status',
                       'Parent',
                       ]

    # We only want certain types of records; the others are deemed to not
    # be useful in this context.  Rather than whitelisting and risking missing
    # newly added types, we blacklist the types we want to ignore.
    # FIXME: THis is Al's guess at the blacklist.  Waiting on the right
    # FIXME: list from Carol.

    type_blacklist = {
        'CDS',
        'C_gene_segment',
        'D_gene_segment',
        'D_loop',
        'J_gene_segment',
        'V_gene_segment',
        'enhancer',
        'match',
        'match-part',
        'ncRNA',
        'origin_of_replication',
        'pseudogenic_CDS',
        'pseudogenic_C_gene_segment',
        'pseudogenic_D_gene_segment',
        'pseudogenic_J_gene_segment',
        'pseudogenic_V_gene_segment',
        'pseudogenic_start_codon',
        'pseudogenic_stop_codon',
        'pseudogenic_three_prime_UTR',
        'sequence_alteration',
        'sequence_feature',
        'start_codon',
        'stop_codon',
    }

    types_not_currently_used = {
        'miRNA_Cluster',
        'mRNA'
        'exon',
        'pseudogene',
        'pseudogenic_transcript',
        'pseudogenic_exon',
        'transcript',
        'five_prime_UTR',
        'three_prime_UTR',
        'primary_transcript',
        'tRNA',
        'pseudogenic_mRNA',
        'pseudogenic_five_prime_UTR',
        'rRNA',
    }

    type_blacklist |= types_not_currently_used

    cur = db_con.cursor()

    for line in gff:
        line = line.strip()
        if line[0] == '#':
            continue
        cols = line.split('\t')
        d = dict(zip(columns, cols))

        if d['type'] in type_blacklist:
            continue

        aliases = []

        # remove "chr" from the start of the seq_id, if it is there.
        if d['seq_id'].upper().startswith('CHR'):
            d['seq_id'] = d['seq_id'][3:]

        # Initialize all the attribute fields. No record will have all of these
        # except for ID, we think.
        for n in attribute_names:
            d[n.lower()] = None

        # Break out the attributes we're looking for.
        attributes = d['attributes'].split(';')
        for a in attributes:
            (name, value) = [x.strip() for x in a.split('=')]
            if name in attribute_names:
                d[name.lower()] = value
            if name == 'Alias':
                aliases.append(value)

        # We don't need the attributes key anymore.
        del(d['attributes'])

        # GFF3 files indicate "no value" with a dot (period). Here, we turn
        # those into None, which will materialize in the DB as "null".
        for k, v in d.items():
            if v == '.':
                d[k] = None

        # Time to load the database.
        query = """INSERT INTO feature (
                     taxon_id, seq_id, source, type, start, end, score, strand, phase,
                     id, name, dbxref, bio_type, status, parent)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"""

        params = (taxon_id, d['seq_id'], d['source'], d['type'], d['start'],
                  d['end'], d['score'], d['strand'], d['phase'], d['id'],
                  d['name'], d['dbxref'], d['biotype'], d['status'],
                  d['parent'])
        try:
            cur.execute(query, params)
        except sqlite3.IntegrityError as e:
            print(e, file=sys.stderr)
            print(line, file=sys.stderr)
            print(d, file=sys.stderr)
            db_con.rollback()
            continue
        db_con.commit()


def main():
    args = parse_args()
    db_con = sqlite3.connect(args.database)
    if args.create:
        create_tables(db_con)
    load_file(db_con, args.filepath, args.taxonid)


if __name__ == '__main__':
    main()