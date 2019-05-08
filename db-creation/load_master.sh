#! /bin/bash

#
# This script is intended to be run from the top-level synteny directory.
#
# Supply a single parameter, which is the name of the database to be created
# and loaded.
#

# Loads:
# - genes
# - transcripts (canonical only at this point)
# - exons
# - homologs  (Currently disabled; loading from file instead, below.)
# - syntenic blocks
echo Running from_intermine
data-scripts/from_intermine.py $1

# Loads:
# - GO
# - MP ontology
# - mouse gene to MP term mappings
# Need to extend it to load:
# - human gene to MP term mappings
# - gene to GO term mappings
echo running import_ontology
data-scripts/import_ontology.py $1

# Load the homologs (syntenic regions) from a file.
echo running homologs_from_file
data-scripts/homologs_from_file.py $1 data-scripts/data-files/MMHomologs.tsv.gz

# Load the mouse QTLs
echo loading mouse QTLs from QTL_JBrowse.gff3.gz
data-scripts/features_from_gff3_file.py $1 data-scripts/data-files/QTL_JBrowse.gff3.gz 10090 -c

# Load mouse features including genes, etc. into features table as well
# as the gene, transcript, and exon tables, which was done in from_intermine.py
#echo loading selected mouse features from MGI.gff3.gz
#data-scripts/features_from_gff3_file.py $1 data-scripts/data-files/MGI_GenomeFeature_forSynteny.gff3.gz 10090
