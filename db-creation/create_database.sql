-- Use this script to create the sqlite3 database like this:
-- sqlite3 synteny.db < create_database.sql

-- This file will eventually be obsolete, as the loaders are creating their
-- tables locally.  That centralized schema changes.

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
            name TEXT,
            symbol TEXT,
        PRIMARY KEY (ref_taxonid, comp_taxonid, ref_chr, ref_start_pos)
        );

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
        );

CREATE TABLE transcript (
            transcript_id TEXT,
            gene_id TEXT,
            taxonid INTEGER,
            is_canonical BOOLEAN,
        PRIMARY KEY (transcript_id, taxonid)
        );
CREATE INDEX transcript_idx ON transcript (is_canonical, gene_id, taxonid);

CREATE TABLE feature_alias (
            alias TEXT,
            taxonid INTEGER,
            id TEXT
        );
CREATE INDEX alias_alias_idx on feature_alias(alias);
CREATE INDEX alias_id_idx on feature_alias(id);

CREATE TABLE exon (
            transcript_id TEXT,
            exon_chr TEXT,
            exon_start_pos INTEGER,
            exon_end_pos INTEGER
        );
CREATE INDEX exon_idx ON exon (transcript_id);

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
        );

CREATE TABLE feature (
            taxon_id INTEGER NOT NULL,
            seq_id TEXT NOT NULL,
            source TEXT NOT NULL,
            type TEXT NOT NULL,
            start INTEGER NOT NULL,
            end INTEGER NOT NULL,
            score REAL,
            strand TEXT,
            phase INTEGER,
            id TEXT NOT NULL,
            symbol TEXT NOT NULL,
            dbxref TEXT NOT NULL,
            gene_type TEXT,
            status TEXT,
            parent TEXT,
         PRIMARY KEY (taxon_id, id)
        );

CREATE TABLE gene_ontology (
            go_id TEXT,
            go_name TEXT,
            go_namespace TEXT,
            go_def TEXT,
        PRIMARY KEY (go_id)
        );

CREATE TABLE ontology (
            gene_id TEXT,
            gene_ontology_id TEXT,
            gene_taxonid INTEGER,
        PRIMARY KEY (gene_id, gene_ontology_id, gene_taxonid)
        );

CREATE TABLE human_omim(
            omim_id TEXT,
            gene_id TEXT,
            omim_term TEXT,
        PRIMARY KEY (omim_id, gene_id)
        );

CREATE TABLE mouse_phenotype (
            mouse_gene_id TEXT,
            mouse_phenotype_symbol TEXT,
            mouse_phenotype_id TEXT,
            mouse_phenotype_term TEXT,
        PRIMARY KEY (mouse_phenotype_id, mouse_gene_id)
        );
