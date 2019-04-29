#! /usr/bin/env python3

import sys
import argparse
import sqlite3
from flex_open import flex_open

def parse_args():
    parser = argparse.ArgumentParser()
    # The database name (required)
    parser.add_argument('database')
    parser.add_argument('-g', '--go-obo',
                        default='data-scripts/source-data/go-basic.obo.gz',
                        help="Path to the go obo file.")
    parser.add_argument('-m', '--mp-obo',
                        default='data-scripts/source-data/MPheno_OBO.ontology.gz',
                        help="Path to the mammalian phenotypes ontology file.")
    parser.add_argument('-d', '--do-obo',
                        default='data-scripts/source-data/HumanDO.obo.gz',
                        help="Path to the human disease ontology file.")
    parser.add_argument('-H', '--human-annotations',
                        default='data-scripts/source-data/goa_human.gaf.gz',
                        help="Path to human ontology annotations.")
    parser.add_argument('-M', '--mouse-annotations',
                        default='data-scripts/source-data/gene_association.mgi.gz',
                        help="Path to mouse ontology annotations."
                        )
    parser.add_argument('--mouse-mp-to-gene',
                        default='data-scripts/source-data/MouseMP_to_gene.txt.gz',
                        help="Path to the file mapping mouse genes to MP terms")
    args = parser.parse_args()
    return args

is_a = {}


def record_is_a(term, isa_term):
    """
    The GO ontology has an is_a set of relationships, which go from general
    terms to ever more specialized terms.

    To be able to handle the inheritance of terms, we need to track all.
    Later, we'll propagate all the relationships, then record all in
    the database.
    This is a bit complicated.  is_a is a transitive relationship.
        a is_a b, b is_a c => a is_a c

    Eventually, we're going to have to be able to look at c, and find all of its
    "sub-terms" (not a real term in ontology-land, I suspect).

    To make it more interesting , is_a is a many-to-many relationship:

        a is_a b
        a is_a q
        b is_a c
        d is_a c
        x is_a q

    To track this, we first build a dictionary of all the more specialized
    terms, i.e., a, b, d, and x above, with the value of those entries being
    a set of the more general terms.

    Then we're going to invert it and propagate all the relationships. In that
    way, from a parent we'll be able to find all the children, of any
    "generation".

    :param term: The term which has this is_a relationship, i.e., the more
                 specialized term.
    :param isa_term: The term in the is_a: line, the more general term.
    :return: None
    """
    if term not in is_a:
        is_a[term] = set()
    is_a[term].add(isa_term)


def save_is_a(db_con):
    c = db_con.cursor()

    # First, we need to invert the is_a dict, so that we have a dictionary of
    # general terms pointing to all their specialized terms. This is only
    # inversion.  Propagation comes later.
    inv = {}
    for specialized in is_a.keys():
        for generalized in is_a[specialized]:
            if generalized not in inv:
                inv[generalized] = set()
            inv[generalized].add(specialized)

    # Now to propagate all the specialized up to their more (and more...)
    # general terms.
    for generalized in inv.keys():
        # make a copy of the new
        s = inv[generalized]
        l = list(s)

        # Walk the list of all the more specialized terms.
        for id in l:
            # Look up the yet more specialized values, and add them to the
            # initial set (s, above), AND to the list we're walking, so we'll
            # pick up their children, too.
            try:
                # If this term has more specialized terms, process them.
                ss = inv[id]
                for s_id in ss:
                    s.add(s_id)
                    l.append(s_id)
            except:
                # If not, don't care.
                pass

    # Propagation is done. Save them in the database.
    for generalized in sorted(inv.keys()):
        for s in sorted(list(inv[generalized])):
            c.execute('''
                INSERT INTO on_pairs (
                  parent, child, relationship)
                  VALUES(?, ?, 'is_a')
            ''', (generalized, s)
            )
        # Update the generalized term in the ontology table with the length
        # of the specialized term list.
        c.execute('''
            UPDATE on_terms SET count = ? WHERE id = ?
        ''', (len(inv[generalized]), generalized))


def create_tables(db_con):
    c = db_con.cursor()

    c.execute('''DROP TABLE IF EXISTS on_terms''')
    c.execute('''
        CREATE TABLE on_terms (
          id TEXT,
          name TEXT,
          namespace TEXT,
          def TEXT,
          count INTEGER,
          PRIMARY KEY (id)
        )
    ''')
    c.execute('''CREATE INDEX on_terms_id_idx ON on_terms(id)''')
    c.execute('''CREATE INDEX on_name_idx ON on_terms(name)''')

    c.execute('''DROP TABLE IF EXISTS on_pairs''')
    c.execute('''
        CREATE TABLE on_pairs (
          parent TEXT,
          child TEXT,
          relationship TEXT
        )
    ''')
    c.execute('''CREATE INDEX rel_idx ON on_pairs(parent, relationship)''')

    c.execute('''DROP TABLE IF EXISTS gene_ontology_map''')
    c.execute('''
        CREATE TABLE gene_ontology_map (
            gene_id TEXT,
            ontology_id TEXT,
            taxonid INTEGER
        )
    ''')
    c.execute('''CREATE INDEX gene_ont_map_gene_id_idx ON
                  gene_ontology_map(gene_id, ontology_id)''')
    c.execute('''CREATE INDEX gene_ont_map_ont_id_idx ON
                  gene_ontology_map(ontology_id)''')
    c.execute('''CREATE INDEX gene_ont_map_taxonid_id_idx ON
                  gene_ontology_map(ontology_id)''')

def import_ontology(obo_file, db_con):
    c = db_con.cursor()

    first_out = False
    in_term = False
    new_term = {}
    f = flex_open(obo_file)
    for line in f:
        line = line.strip()
        if not line:
            continue

        if line[0] == '[' and not line.startswith('[Term]'):
            in_term = False
        if line.startswith("[Term]"):
            # We're starting a new term. capture what we've seen for the current
            # one.
            # REMEMBER: We have to do this at the end of the file as well!
            if new_term:  # First time we hit [Term] we won't hve data yet.
                try:
                    c.execute('''
                        INSERT INTO on_terms (id, name, namespace, def)
                        VALUES(?, ?, ? , ?) ''',
                        (
                            new_term['id'],
                            new_term['name'],
                            new_term.get('namespace', None),
                            new_term.get('def', None),
                        )
                    )
                except sqlite3.IntegrityError:
                    print("Duplicate key!", new_term)
                    raise
            # Get ready for the next one.
            new_term = {}
            in_term = True

        # Skip if we're not in a term...
        if not in_term:
            continue

        # In a term, process it.
        if line.startswith("id: "):
            id = line.replace("id: ", "")
            new_term['id'] = id
        if line.startswith("name: "):
            name = line.replace("name: ", "")
            new_term['name'] = name
        if line.startswith("namespace: "):
            namespace = line.replace("namespace: ", "")
            new_term['namespace'] = namespace
        if line.startswith("def: "):
            definition = line.replace("def: ", "")
            new_term['def'] = definition
        if line.startswith('is_a: '):
            try:
                record_is_a(new_term['id'], line.split()[1])
            except KeyError:
                print(new_term)
                sys.exit(1)
        if line.startswith('is_obsolete: ') and \
            line.split()[1].lower() == 'true':
            # This is an obsolete term. Ignore it.
            new_term = {}    # Throw away what we've collected so far
            in_term = False  # Ignore lines until next [Term] line

    # save the last one in the DB
    c.execute('''
        INSERT INTO on_terms (id, name, namespace, def)
            VALUES(?, ?, ? , ?) ''',
                  (
                      new_term['id'],
                      new_term['name'],
                      new_term.get('namespace', None),
                      new_term.get('def', None),
                  )
              )


def import_gene_ontology(fname, taxonid, db_con):
    c = db_con.cursor()
    with flex_open(fname) as f:
        for line in f:
            line = line.strip()
            if line[0] == '!':
                continue
            components = line.split("\t")
            gene_taxonid = taxonid
            gene_id = components[1]
            gene_ontology_id = components[4]
            c.execute(
                '''INSERT INTO gene_ontology_map VALUES(?, ? ,?) ''',
                (
                    gene_id,
                    gene_ontology_id,
                    gene_taxonid,
                )
            )


def import_mouse_mp_ontology_genes(fname, taxonid, db_con):
    """
    Format of this file:

      marker_id  |                  symbol                  |   mp_id    |                                        mp_term
-------------+------------------------------------------+------------+----------------------------------------------------------------------------------------
 MGI:1915609 | 0610010K14Rik                            | MP:0011100 | preweaning lethality, complete penetrance
 MGI:1913367 | 1110001J03Rik                            | MP:0000562 | polydactyly
 MGI:1913367 | 1110001J03Rik                            | MP:0001297 | microphthalmia
 MGI:1913367 | 1110001J03Rik                            | MP:0001697 | abnormal embryo size
 MGI:1913367 | 1110001J03Rik                            | MP:0002152 | abnormal brain morphology
 MGI:1913367 | 1110001J03Rik                            | MP:0011110 | preweaning lethality, incomplete penetrance
 MGI:1913435 | 1110037F02Rik                            | MP:0003345 | decreased rib number

    :param fname: file to process
    :param taxonid: taxon.  If this remains mouse-specific, this will always be
                    10090
    :param db_con: connection to the database.
    :return: None.
    """

    c = db_con.cursor()
    with flex_open(fname) as f:
        for line in f:
            parts = [x.strip() for x in line.split('|')]
            if len(parts) < 4:
                continue
            if parts[0][:4] != 'MGI:':
                continue
            c.execute('''
                INSERT INTO gene_ontology_map
                  (gene_id, ontology_id, taxonid)
                VALUES (?, ?, ?)''', (parts[0], parts[2], taxonid))



def main():
    args = parse_args()
    db_con = sqlite3.connect(args.database)

    create_tables(db_con)

    import_ontology(args.go_obo, db_con)
    import_ontology(args.mp_obo, db_con)
    import_ontology(args.do_obo, db_con)
    import_gene_ontology(args.mouse_annotations, 10090, db_con)
    import_gene_ontology(args.human_annotations, 9606, db_con)
    import_mouse_mp_ontology_genes(args.mouse_mp_to_gene, 10090, db_con)
    save_is_a(db_con)

    db_con.commit()

if __name__ == '__main__':
    main()
