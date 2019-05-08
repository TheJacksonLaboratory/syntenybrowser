#! /bin/bash

#
# Get MP terms to mouse gene annotations from MGI using a SQL query.
#

# The password to this account is published, so no problem having it here.

PGPASSWORD=mgdpub psql -h adhoc.informatics.jax.org -U mgd_public mgd <<EOF
select distinct a.accid as Marker_ID, m.symbol, a1.accid as MP_ID, vt.term as MP_term
    from mrk_marker m, voc_annot va, voc_term vt, acc_accession a, acc_accession a1
    where va._annottype_key=1015
        and vt._vocab_key = 5
        and a._logicaldb_key = 1
        and a.prefixpart =  'MGI:'
        and a._mgitype_key = 2
        and a.preferred = 1
        and a1._logicaldb_key = 34
        and a1._mgitype_key = 13
        and a1.preferred = 1
        and a._object_key = va._object_key
        and a1._object_key = va._term_key
        and va._object_key = m._marker_key
        and va._term_key = vt._term_key
\g MouseMP_to_gene.txt
EOF
gzip -9 MouseMP_to_gene.txt
