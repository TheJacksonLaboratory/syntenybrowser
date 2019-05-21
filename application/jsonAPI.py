import json
from flask import jsonify
from synbrowser import sqliteaccess as dba
from synbrowser import app


@app.route('/gene-assoc-type-info/<taxon_id>/<gene_list>.json')
def gene_assoc_type_info(taxon_id, gene_list):
    gt_information = dba.get_gt_assoc_info(taxon_id, gene_list)
    return json.dumps(list(gt_information))


@app.route('/fetch-autocomplete-terms/<search_cat>/<search_id>.json')
def fetch_autocomplete_terms(search_cat, search_id):
    """
    Generates suggestions used to feed the type-ahead (autocomplete) UI input component.

    :param (str) search_cat: search category, currently one among {gene, qtl, ont}
    :param (str) search_id: if the search category is 'ontology' then this argument represents
    an 'ontology id', else it represents a 'taxonomy id'
    :return: (str) a JSON formatted string of suggestions
    """
    if search_cat == 'qtl':
        suggest_terms = dba.get_qtl_symbols(search_id)
        return json.dumps(list(suggest_terms))
    elif search_cat == 'gene':
        suggest_terms = dba.get_gene_symbols(search_id)
        return json.dumps(list(suggest_terms))
    elif search_cat == 'ont':
        suggest_terms = dba.get_ont_terms_ids(search_id)
        return json.dumps(list(suggest_terms))
    else:
        suggest_terms = ""
        return json.dumps(list(suggest_terms))


@app.route('/gene-info/<taxon_id>/<gene_symbol>.json')
def gene_info(taxon_id, gene_symbol):
    gene_information = dba.get_gene_info(taxon_id, gene_symbol)
    return json.dumps(list(gene_information))


@app.route('/qtl-info/<taxon_id>/<qtl_symbol>.json')
def qtl_info(taxon_id, qtl_symbol):
    qtl_information = dba.get_qtl_info(taxon_id, qtl_symbol)
    return json.dumps(list(qtl_information))


@app.route('/ont-info/<taxon_id>/<ont_abbrev>/<ont_term>.json')
def species_ont_info(taxon_id, ont_abbrev, ont_term):
    '''
    Finds ontology entries that match the searched term and returns
    information about them and their associated genes in the specified species.

    :param taxon_id: NCBI species taxonomy id
    :param ont_abbrev: ontology short name / abbreviation (i.e. DO, GO, MP, ...)
    :param ont_term: ontology related term
    :return: dictionary objects list containing ontology and gene information
    '''
    ont_information = dba.get_species_genes_labeled_with_term(taxon_id, ont_abbrev, ont_term)
    return json.dumps(list(ont_information))


@app.route('/ont-info/<ont_abbrev>/<ont_term>.json')
def ont_info(ont_abbrev, ont_term):
    '''
    Finds ontology entries that match the searched term and returns
    information about them and their associated genes in the specified species.

    :param taxon_id: NCBI species taxonomy id
    :param ont_abbrev: ontology short name / abbreviation (i.e. DO, GO, MP, ...)
    :param ont_term: ontology related term
    :return: dictionary objects list containing ontology and gene information
    '''
    ont_information = dba.get_genes_labeled_with_term(ont_abbrev, ont_term)
    return json.dumps(list(ont_information))


@app.route('/count-ont-children/<ont_id>/<ont_term>.json')
def count_ont_children(ont_id, ont_term):
    '''

    :param ont_id:
    :param ont_term:
    :return:
    '''
    count = dba.count_ont_children(ont_id, ont_term)
    d = {'num_children': 0}
    if count != None:
        d = {'num_children': count}

    return json.dumps(d)


@app.route('/syntenic-blocks/<ref_taxonid>/<comp_taxonid>/<ref_chr>-blocks.json')
def syntenic_blocks_json(ref_taxonid, comp_taxonid, ref_chr):
    blocks = dba.get_blocks(ref_taxonid, comp_taxonid, True, ref_chr)
    return jsonify(blocks=list(blocks))


@app.route('/syntenic-blocks/<ref_taxonid>/<comp_taxonid>/blocks.json')
def all_syntenic_blocks_json(ref_taxonid, comp_taxonid):
    blocks = dba.get_blocks(ref_taxonid, comp_taxonid)
    return jsonify(blocks=list(blocks))


@app.route('/genes-in-interval/<ref_taxonid>/chr<ref_chr>-genes.json')
def genes_in_interval(ref_taxonid, ref_chr):
    genes = dba.get_genes(ref_taxonid, ref_chr)
    return jsonify(genes=list(genes))


@app.route('/genome-colors')
@app.route('/ChrColorScheme.json')
def chr_color_scheme_json():
    chr_colors = {
        "1": "#f74600",
        "2": "#852c00",
        "3": "#d96c00",
        "4": "#edae00",
        "5": "#7f7300",
        "6": "#fff200",
        "7": "#8bb500",
        "8": "#00cf07",
        "9": "#006b07",
        "10": "#00d498",
        "11": "#007354",
        "12": "#00ecf0",
        "13": "#008f99",
        "14": "#00ccff",
        "15": "#007aa3",
        "16": "#0089fa",
        "17": "#00457d",
        "18": "#004bed",
        "19": "#00217d",
        "20": "#9f00d4",
        "21": "#5b0069",
        "22": "#b80087",
        "X": "#ce4676",
        "Y": "#ea9399"
    }

    return json.dumps(chr_colors)


@app.route('/species', methods=['GET'])
def get_species():
    species = dba.get_species()
    return json.dumps({'species': list(species)})


@app.route('/genes/<taxon_id>', methods=['GET'])
def get_all_genes(taxon_id):
    genes = dba.get_gene_metadata(taxon_id)
    return json.dumps({'genes': list(genes)})


@app.route('/genes/<taxon_id>/<gene_symbol>', methods=['GET'])
def get_genes(taxon_id, gene_symbol):
    genes = dba.get_gene_metadata(taxon_id, gene_symbol)
    return json.dumps({'genes': list(genes)})


@app.route('/qtls/<taxon_id>', methods=['GET'])
def get_all_qtls(taxon_id):
    qtls = dba.get_qtl_metadata(taxon_id)
    return json.dumps({'qtls': list(qtls)})


@app.route('/qtls/<taxon_id>/<qtl_symbol>', methods=['GET'])
def get_qtls(taxon_id, qtl_symbol):
    qtls = dba.get_qtl_metadata(taxon_id, qtl_symbol)
    return json.dumps({'qtls': list(qtls)})


@app.route('/syntenic-blocks/<ref_taxonid>/<comp_taxonid>', methods=['GET'])
def genome_blocks(ref_taxonid, comp_taxonid):
    blocks = dba.get_genome_blocks(ref_taxonid, comp_taxonid)
    return jsonify(blocks=list(blocks))


@app.route('/syntenic-blocks/<ref_taxonid>/<comp_taxonid>/<chr>', methods=['GET'])
def chromsome_blocks(ref_taxonid, comp_taxonid, chr):
    blocks = dba.get_chromosome_blocks(ref_taxonid, comp_taxonid, chr)
    return jsonify(blocks=list(blocks))


@app.route('/chr-genes/<ref_taxonid>/<comp_taxonid>/<ref_chr>')
def chromosome_genes(ref_taxonid, comp_taxonid, ref_chr):
    genes = dba.get_genes(ref_taxonid, ref_chr)
    return jsonify(genes=list(genes))


@app.route('/chr-qtls/<taxon_id>/<chromosome>')
def get_qtls_by_chr(taxon_id, chromosome):
    qtls = dba.get_qtls_by_chr(taxon_id, chromosome)
    return jsonify(qtls=list(qtls))
