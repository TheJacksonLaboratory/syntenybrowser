#!/usr/bin/env python3

f = open('MouseMineSynteny.blocks', 'w')

# The following two lines will be needed in every python script:
from intermine.webservice import Service
service = Service("http://www.mousemine.org/mousemine/service")

# Get a new query on the class (table) you will be querying:
query = service.new_query("SyntenicRegion")

# The view specifies the output columns
query.add_view(
    "chromosome.primaryIdentifier",
    "organism.taxonId",
    "chromosomeLocation.start",
    "chromosomeLocation.end",
    "orientation",
    "symbol"
)

lookup = dict()

# Uncomment and edit the line below (the default) to select a custom sort order:
# query.add_sort_order("SyntenicRegion.primaryIdentifier", "ASC")

for row in query.rows():
  chr=row["chromosome.primaryIdentifier"]
  taxon=row["organism.taxonId"]
  start=row["chromosomeLocation.start"]
  end=row["chromosomeLocation.end"]
  strand=row["orientation"]
  ID=row["symbol"]
  #print ("%s\t%s\t%s\t%s" % (chr,taxon,start,end))
  if row["symbol"] in lookup:
      f.write("%s\t%s\t%s\t%s\t%s\t%s\tID=%s\n" % (lookup[row["symbol"]],chr,taxon,start,end,strand,ID))
  else:
      lookup[row["symbol"]]="%s\t%s\t%s\t%s" % (chr,taxon,start,end)
