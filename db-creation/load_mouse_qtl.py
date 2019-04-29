from itertools import permutations
from intermine.webservice import Service
import argparse
import sqlite3
import re


def import_mouse_qtl(db_con):
    c = db_con.cursor()

    c.execute('''

        CREATE TABLE mouse_qtl (
          qtl_taxon_id INTEGER, qtl_id TEXT,  qtl_symbol TEXT, qtl_chr TEXT, qtl_start_pos INTEGER, qtl_end_pos INTEGER,  qtl_strand TEXT, PRIMARY KEY(qtl_taxon_id, qtl_id)
        )

        ''')

    # Read from the qtl file
    f = open('QTL_JBrowse.gff3', 'r')
    for line in f:
        eles = line.split()
        if len(eles) == 9:
            qtl_taxon_id = 10090
            qtl_strand = "null"
            qtl_chr = eles[0].replace("chr","")
            qtl_start_pos = eles[3]
            qtl_end_pos = eles[4]
            eles2 = eles[8].split(';')
            ele = eles2[0]
            qtl_id = ele.replace("ID=", "")
            ele = eles2[1]
            qtl_symbol = ele.replace("Name=", "")
            c.execute(
                '''INSERT INTO mouse_qtl VALUES (?, ?, ?, ?, ?, ?, ?)''',
                (
                    int(qtl_taxon_id),
                    qtl_id,
                    qtl_symbol,
                    qtl_chr,
                    int(qtl_start_pos),
                    int(qtl_end_pos),
                    qtl_strand,
                )
            )



def import_mouse_phenotype(db_con):
    c = db_con.cursor()

    c.execute('''

        CREATE TABLE mouse_phenotype (
          mouse_gene_id TEXT, mouse_phenotype_symbol TEXT,  mouse_phenotype_id TEXT, mouse_phenotype_term TEXT,  PRIMARY KEY(mouse_phenotype_id, mouse_gene_id)
        )

        ''')

    # Read from the qtl file
    f = open('MouseMP_to_gene.txt', 'r')
    for line in f:
        eles = line.split("|")
        if len(eles) == 4:
            mouse_gene_id = eles[0].replace(" ", "")
            mouse_gene_symbol = eles[1].replace(" ", "")
            mouse_phenotype_id = eles[2].replace(" ", "")
            mouse_phenotype_term = eles[3].replace("/", " ")

            c.execute(
                '''INSERT INTO mouse_phenotype VALUES (?, ?, ?, ?)''',
                (
                    mouse_gene_id,
                    mouse_gene_symbol,
                    mouse_phenotype_id,
                    mouse_phenotype_term,
                )
            )


def import_omim_human_data(db_con):
    c = db_con.cursor()
    omim_terms_file_handler = open('MimTerm.txt', 'r')
    omim_term_list = []
    for line in omim_terms_file_handler:
        line = line.rstrip()
        components = line.split("\t")
        omim_term = {
            "id": components[0],
            "term": components[1].replace('/', ' ')
        }
        omim_term_list.append(omim_term)

    omim_gene_id_file_handler = open('MimIDVSGeneID.txt', 'r')
    omim_gene_term_list=[]
    for line in omim_gene_id_file_handler:
        line = line.rstrip()
        components = line.split("\t")
        for term in omim_term_list:
            if components[0] == term["id"]:
                omim_id = components[0]
                gene_id = components[1]
                omim_term = term["term"]
                c.execute(
                    '''INSERT INTO human_omim VALUES(?,?,?)''',
                    (
                        omim_id,
                        gene_id,
                        omim_term,

                    )
                )


def import_human_gene_type(db_con):
    c = db_con.cursor()
    human_gene_type_file_handler = open('NCBI_Human_Gene_Type.txt', 'r')
    for line in human_gene_type_file_handler:
        line.rstrip()
        matchObj = re.search('(Alias=\d*);.*(Gene_Type=.*)', line)
        gene_id = matchObj.group(1).replace("Alias=", "")
        gene_type = matchObj.group(2).replace("Gene_Type=", "")
        c.execute(
            '''UPDATE gene set gene_type = ? WHERE gene_id = ? ''',
            (
                gene_type,
                gene_id,
            )
        )


def import_mouse_gene_type(db_con):
    c = db_con.cursor()
    mouse_gene_type_file_handler = open('MGI_Mouse_Gene_Type.txt', 'r')
    for line in mouse_gene_type_file_handler:
        line.rstrip()
        matchObj = re.search('ID=(\d*);.*Gene_Type=(.*)', line)
        gene_id = "MGI:" + matchObj.group(1)
        gene_type = matchObj.group(2)
        c.execute(
            '''UPDATE gene set gene_type = ? WHERE gene_id = ?''',
            (
                gene_type,
                gene_id,
            )
        )



def import_ontology_pairs(db_con):
    c = db_con.cursor()
    mouse_gene_ontology_file_handler = open ('Ontology_Pairs.txt', 'r')
    for line in mouse_gene_ontology_file_handler:
        line = line.rstrip()
        components = line.split("\t")
        parent_id = components[0]
        child_id = components[1]
        relationship_type = components[2]
        c.execute(
            '''INSERT INTO on_pairs VALUES(?, ? ,?) ''',
            (
                parent_id,
                child_id,
                relationship_type,
            )
        )


def import_ontology_terms(db_con):
    c = db_con.cursor()
    mouse_gene_ontology_file_handler = open ('Ontology_Terms.txt', 'r')
    for line in mouse_gene_ontology_file_handler:
        line = line.rstrip()
        components = line.split("\t")
        term_id = components[0]
        name = components[1]
        ontology_id = components[2]
        c.execute(
            '''INSERT INTO on_terms VALUES(?, ? ,?) ''',
            (
                term_id,
                name,
                ontology_id,
            )
        )


def main():

    # parse command line arguments
    parser = argparse.ArgumentParser(description='import data into a sqlite3 database')
    parser.add_argument(
        'intermine_db',
        help='the SQLite3 DB file that will be created or updated')
    args = parser.parse_args()

    db_con = sqlite3.connect(args.intermine_db)

    import_ontology_terms(db_con)
    #import_ontology_pairs(db_con)
    #import_mouse_gene_type(db_con)
    #import_human_gene_type(db_con)
    #import_omim_human_data(db_con)
    #import_mouse_human_gene_ontology(db_con)
    #import_gene_ontology(db_con)
    #import_human_transcripts(db_con)
    #import_human_transcripts_old(db_con)
    #import_mouse_transcripts(db_con)

    #import_mouse_qtl(db_con)
    #import_mouse_phenotype(db_con)


    db_con.commit()


if __name__ == '__main__':
    main()
