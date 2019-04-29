from intermine.webservice import Service

outfile = open('MMHomologs.tsv', 'w')
outfile.write ("##Type\tTaxonID\tID\tSymbol\tStart\tEnd\tTaxonID\tID\tSymbol\tStart\tEnd\n")
service = Service("http://www.mousemine.org/mousemine/service")
query = service.new_query("Homologue")
query.add_view(
    "type", "gene.organism.name", "gene.primaryIdentifier", "gene.symbol",
    "homologue.organism.name", "homologue.primaryIdentifier", "homologue.symbol",
    "gene.chromosomeLocation.start", "gene.chromosomeLocation.end", "gene.chromosome.primaryIdentifier", "homologue.chromosome.primaryIdentifier",
    "homologue.organism.taxonId", "gene.organism.taxonId", "homologue.chromosomeLocation.start", "homologue.chromosomeLocation.end"
)
query.add_constraint("gene.organism.name", "=", "Homo sapiens", code = "A")
query.add_constraint("homologue.organism.name", "=", "Mus musculus", code = "B")
query.add_constraint("type", "=", "orthologue", code = "C")

##PLEASE NOTE... in this query gene.[...] is for human and homologue.[...] is mouse

for row in query.rows():
    outfile.write ( str(row["type"])+'\t'+str(row["gene.organism.taxonId"])+'\t'+str(row["gene.primaryIdentifier"])+'\t'+str(row["gene.symbol"])+'\tchr'+str(row["gene.chromosome.primaryIdentifier"])+'\t'+
    str(row["gene.chromosomeLocation.start"])+'\t'+str(row["gene.chromosomeLocation.end"])+'\t'+str(row["homologue.organism.taxonId"])+'\t'+
    str(row["homologue.primaryIdentifier"])+'\t'+str(row["homologue.symbol"])+'\tchr'+str(row["homologue.chromosome.primaryIdentifier"])+'\t'+str(row["homologue.chromosomeLocation.start"])+'\t'+
    str(row["homologue.chromosomeLocation.end"])+'\n')
