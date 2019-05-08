### Synteny Browser Database Creation Directory
This directory contains all of the scripts and flat data files required to load a fully-functional database for running
the Synteny Browser application with Mus musculus and Homo sapiens as available species. A more in-depth breakdown
of the data files and the data each contains can be found [here](data-files/README.md) and directions to loading a
database can be found here [here](../README.md).

### File Purpose Summaries
Below are brief descriptions of the scripts used to load a database.

* `features_from_gff_file.py` - loads data from a specified .gff3 formatted file into features table
* `flex_open.py` - contains a utility function that assists in opening .gz and non-.gz compressed files
* `from_intermine.py` - loads gene, transcript, exon, and syntenic blocks data from MouseMine using their web service
* `homologs_from_file.py` - loads homolog data from specified file
* `import_ontology.py` - loads ontology data from flat files