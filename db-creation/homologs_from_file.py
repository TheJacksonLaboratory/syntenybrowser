#! /usr/bin/env python3
"""
Loads the homologs into the database from a tab-separated file with the
following column names in the first row (all case insensitive):
    type
    taxonid1
    id1
    symbol1
    seqid1
    start1
    end1
    taxonid2
    id2
    symbol2
    seqid2
    start2
    end2

The "id" columns are the gene's official ID from the taxon authority, e.g.,
MGI for mouse. The symbol columns are the gene's symbols.
"""
import argparse
import sqlite3
import sys
import csv

from flex_open import flex_open

HOM_FILE_HEADER_COLUMNS = [
    'type',
    'taxonid1', 'id1', 'symbol1', 'seqid1', 'start1', 'end1', 'strand1',
    'taxonid2', 'id2', 'symbol2', 'seqid2', 'start2', 'end2', 'strand2',
]


def parse_args():
    parser = argparse.ArgumentParser()
    # The database name (required)
    parser.add_argument('database')
    parser.add_argument('homologs')
    args = parser.parse_args()
    return args


def create_table(db_con):
    """
    Create the hommolog table, dropping any existing table first.
    :param db_con: A connection to an sqlite3 database.
    :return: None
    """
    cur = db_con.cursor()

    cur.execute('''DROP TABLE IF EXISTS homolog''')
    cur.execute('''
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
        )''')
    db_con.commit()
    cur.execute('''CREATE INDEX homolog_comp_gene_id_idx ON
                    homolog(comp_gene_id, ref_gene_id)''')
    cur.execute('''CREATE INDEX homolog_ref_taxon_gene_idx ON
                    homolog(ref_taxon_id, ref_gene_id)''')
    cur.execute('''CREATE INDEX homolog_comp_taxon_gene_idx ON
                    homolog(comp_taxon_id, comp_gene_id)''')
    cur.execute('''CREATE INDEX homolog_ref_chr_idx ON
                    homolog(ref_seq_id)''')


def load_homologs(db_con, homolog_filepath):
    """
    Load the contents of the file into the database. Each homolog is loaded
    twice, swapping reference and comparison organisms.
    :param db_con: A connection to an sqlite3 database.
    :param homolog_filepath: File path to the file to be loaded.
    :return: Number of homologs loaded. (Twice as many as rows in the file.)
    """
    hom_file = flex_open(homolog_filepath)
    header = hom_file.readline()
    # Remove leading ##, if it exists.
    if header.startswith('##'):
        header = header[2:]
    columns = [x.strip().lower() for x in header.split('\t')]

    # Check that we have all the expected headers
    missing = False
    for col in HOM_FILE_HEADER_COLUMNS:
        if col not in columns:
            print("Expected header {0} is missing.".format(col),
                  file=sys.stderr)
            missing = True
    if missing:
        print('Please correct and try again.')
        return

    # Let the user know if there are extra columns, but keep going
    for col in columns:
        if col not in HOM_FILE_HEADER_COLUMNS:
            print("Ignoring extra column {0}".format(col),
                  file=sys.stderr)

    cur = db_con.cursor()
    reader = csv.DictReader(hom_file, fieldnames=HOM_FILE_HEADER_COLUMNS,
                            delimiter='\t')
    # Now load all the rows.
    query = """INSERT OR REPLACE INTO homolog (
                 ref_gene_id, ref_gene_sym, ref_taxon_id, ref_seq_id,
                 ref_start, ref_end, ref_strand,
                 comp_gene_id, comp_gene_sym, comp_taxon_id,
                 comp_seq_id, comp_start, comp_end, comp_strand)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """

    for row in reader:
        # remove "chr" from the start of the seqids, if it is there.
        if row['seqid1'].upper().startswith('CHR'):
            row['seqid1'] = row['seqid1'][3:]
        if row['seqid2'].upper().startswith('CHR'):
            row['seqid2'] = row['seqid2'][3:]

        if row['type'].strip().upper() != 'ORTHOLOGUE':
            print("Unexpected type found.  Expected 'orthologue', found {0}.\n"
                  "Line is: {1}".format(row['Type'], row))
        # Load the relationships both ways.
        reference = (row['id1'], row['symbol1'], row['taxonid1'],
                     row['seqid1'], row['start1'], row['end1'], row['strand1'])
        comparison = (row['id2'], row['symbol2'], row['taxonid2'],
                      row['seqid2'], row['start2'], row['end2'], row['strand2'])
        cur.execute(query, reference + comparison)
        cur.execute(query, comparison + reference)
        db_con.commit()


def main():
    args = parse_args()
    db_con = sqlite3.connect(args.database)
    create_table(db_con)
    load_homologs(db_con, args.homologs)


if __name__ == '__main__':
    main()
