#! /bin/bash

#
# This script is intended to be run from the top-level synteny directory.
#
# Supply a single parameter, which is the name of the database to be created
# and loaded.
#

# Loads:
# - genes
# - canonical transcripts
# - exons
# - syntenic blocks
echo Loading data from MouseMine
db-creation/from_intermine.py $1

# Loads: GO, MP, DO
echo Loading ontology data
db-creation/import_ontology.py $1

# Load the homologs (syntenic regions) from a file.
echo Loading homolog data
db-creation/homologs_from_file.py $1 db-creation/data-files/MMHomologs.tsv.gz

# Load the mouse QTLs
echo Loading mouse QTLs
db-creation/features_from_gff3_file.py $1 db-creation/data-files/QTL_JBrowse.gff3.gz 10090 -c
