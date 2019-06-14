from intermine.webservice import Service

outfile = open('MMHomologs.tsv', 'w')
outfile.write("##Type\tTaxonID1\tID1\tSymbol1\tSeqID1\tStart1\tEnd1\tStrand1\tTaxonID2\tID2\tSymbol2\tSeqID2\tStart2\tEnd2\tStrand2\n")
service = Service("http://www.mousemine.org/mousemine/service")
query = service.new_query("Homologue")
query.add_view(
    "type", "gene.organism.name", "gene.primaryIdentifier", "gene.symbol",
    "homologue.organism.name", "homologue.primaryIdentifier", "homologue.symbol",
    "gene.chromosomeLocation.start", "gene.chromosomeLocation.end",
    "gene.chromosome.primaryIdentifier", "homologue.chromosome.primaryIdentifier",
    "homologue.organism.taxonId", "gene.organism.taxonId",
    "homologue.chromosomeLocation.start", "homologue.chromosomeLocation.end",
    "homologue.chromosomeLocation.strand", "gene.chromosomeLocation.strand"
)
query.add_constraint("gene.organism.name", "=", "Homo sapiens", code="A")
query.add_constraint("homologue.organism.name", "=", "Mus musculus", code="B")
query.add_constraint("type", "=", "orthologue", code="C")

##PLEASE NOTE... in this query gene.[...] is for human and homologue.[...] is mouse
for row in query.rows():
    if row["gene.chromosomeLocation.strand"] == '1':
        gene_strand = '+1'
    else:
        gene_strand = '-1'

    if row["homologue.chromosomeLocation.strand"] == '1':
        homologue_strand = '+1'
    else:
        homologue_strand = '-1'

    outfile.write(str(row["type"])+'\t'+str(row["gene.organism.taxonId"])+'\t'+str(row["gene.primaryIdentifier"])+'\t'+
                  str(row["gene.symbol"])+'\t'+str(row["gene.chromosome.primaryIdentifier"])+'\t'+
                  str(row["gene.chromosomeLocation.start"])+'\t'+str(row["gene.chromosomeLocation.end"])+'\t'+
                  str(gene_strand)+'\t'+str(row["homologue.organism.taxonId"])+'\t'+
                  str(row["homologue.primaryIdentifier"])+'\t'+str(row["homologue.symbol"])+'\t'+
                  str(row["homologue.chromosome.primaryIdentifier"])+'\t'+str(row["homologue.chromosomeLocation.start"])+
                  '\t'+str(row["homologue.chromosomeLocation.end"])+'\t'+str(homologue_strand)+
                  '\t\n')
