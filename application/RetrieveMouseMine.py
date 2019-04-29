from intermine.webservice import Service

def main():

    service = Service("http://www.mousemine.org/mousemine/service")

    # Get a new query on the class (table) you will be querying:
    query = service.new_query("SyntenicRegion")

    # The view specifies the output columns
    query.add_view(
        "name", "symbol", "orientation", "chromosomeLocation.start",
        "chromosomeLocation.end", "organism.species", "partner.organism.species",
        "chromosome.name", "partner.chromosome.length",
        "partner.chromosome.name",
        "partner.chromosomeLocation.start", "partner.chromosomeLocation.end"
    )

    # Uncomment and edit the line below (the default) to select a custom sort order:
    # query.add_sort_order("SyntenicRegion.name", "ASC")

    # You can edit the constraint values below
    query.add_constraint("organism.species", "=", "musculus", code = "A")
    query.add_constraint("partner.organism.species", "=", "sapiens", code = "B")

    print ("[")
    for row in query.rows():
        mousename = row["chromosome.name"]
        mouserow = mousename.split(" ")
        humanname = row["partner.chromosome.name"]
        humanrow = humanname.split(" ")
        print(
            "{mchr:\"",
            mouserow[1].strip(),"\"",
            ", mstart:",
            row["chromosomeLocation.start"],
            ", mend:",
            row["chromosomeLocation.end"],
            ", hchr:\"",
            humanrow[1].strip(), "\"",
            ", hstart:",
            row["partner.chromosomeLocation.start"],
            ", hend:",
            row["partner.chromosomeLocation.end"],
            "},")

    print("]")
    # for row in query.rows():
    #     print(
    #         "Synteny Block", row["name"] + ':',
    #         row["organism.species"],
    #         '=>',
    #         row["partner.organism.species"])
    #     print(
    #         "Reference interval: ",
    #         row["chromosome.name"],
    #         row["chromosomeLocation.start"], \
    #         row["chromosomeLocation.end"])
    #     print(
    #         "Comparison interval: ",
    #         row["partner.chromosome.name"],
    #         row["partner.chromosomeLocation.start"],
    #         row["partner.chromosomeLocation.end"])

if __name__ == '__main__':
    main()