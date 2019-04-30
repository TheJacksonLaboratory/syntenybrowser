"use strict";

let DataManager;

(function(DataManager) {
    ///////////////////////////////////////////////////////////////////////////
    // BlockViewManager Class
    ///////////////////////////////////////////////////////////////////////////
    DataManager.BlockViewManager = (function() {
        /**
         * @constructor
         */
        function BlockViewManager() {
            // html element references
            this._input = $("#ref-genome-interval");
            this._inputnote = $("#ref-genome-interval-msg");

            this._syntenicBlocksData = [];

            this._chromosome = null;
            this._refSpecies = null;

            // data collections
            this._referenceGeneData = [];
            this._comparisonGeneData = [];

            this._referenceHomologs = {};
            this._homologIds = {}; // lookup genes by homolog_id

            this._genesToHomologs = {}; // lookup homologs by gene_id
			
            this._blockViewBrowser = new BlockView.BlockViewBrowser();

            let that = this;

            // html element(s) event handlers
            BlockViewManager.prototype.loadBlockViewBrowser = function() {
                // remove existing block view svg content, if any exists
                d3.select("#block-view-svg").selectAll("*").remove();
                d3.select("#chr-color-legend").selectAll("*").remove();

                // show the spinner animation
                $("#spinner").show();

                let openSettings = $("#set-open");

                // interval on the reference chromosome
                let interval = SynUtils.parseReferenceInterval(that.getReferenceInterval());

                let validator = new DataManager.InputValidation();
                validator.validChromosome(interval.chr);
                validator.validGenomicInterval(interval.chr, interval.startPos, interval.endPos);

                // if there is an interval specified and interval clear validation, load interval
                if(interval && validator.getValidationStatus()) {
                    // clear message (in case user entered input in less than 10 seconds)
                    that._inputnote.html("");

                    // check that a chromosome value has been set
                    if(interval.chr) {
                        // if it is different from the currently displayed chromosome
                        // or species (or if no chromosome has been displayed at all)
                        let newGenes = JaxSynteny.highlightedFeatures.gene;
                        let newQTLs = JaxSynteny.highlightedFeatures.qtl;
                        let existingGenes = that._blockViewBrowser._highlightedGenes;
                        let existingQTLs = that._blockViewBrowser._highlightedQTLs;

                        let highlightedGenesChanged = SynUtils.checkArrayEquivalency(newGenes, existingGenes);
                        let highlightedQTLsChanged = SynUtils.checkArrayEquivalency(newQTLs, existingQTLs);
                        let chromosomeChanged = that._chromosome === null || that._chromosome !== interval.chr;
                        let refSpeciesChanged = that._refSpecies !== JaxSynteny.speciesRef.getSpeciesId();

                        if(chromosomeChanged || refSpeciesChanged || highlightedGenesChanged || highlightedQTLsChanged) {

                            that._refSpecies = JaxSynteny.speciesRef.getSpeciesId();
                            that._chromosome = interval.chr;

                            openSettings.addClass("closed");
                            openSettings.animate({right: "0px"}, 500);

                            // load syntenic block data for rendering first
                            that.loadData(that._chromosome);

                        } else {
                            that._blockViewBrowser.setReferenceInterval(interval);
                            that._blockViewBrowser.changeInterval("1");
                        }
                        // if input is successfully validated, open the block view panel
                        SynUtils.openBlockView();
                    }
                } else {
                    that._input.focus();
                    // if input isn't present make input note state the required entry
                    if(!interval) {
                        that._inputnote.html("&larr; Enter valid genome coordinates " +
                            "<br/> Eg: Chr1:10000000-20000000");
                    }
                    // if the input was invalid, make input note display the first error message
                    else {
                        that._inputnote.html(validator._errors[0]);
                    }
                    // hide message after 10 seconds
                    setTimeout(function() {
                        that._inputnote.html("");
                    }, 10000);

                }
            };


            /**
             * updates the block view
             */
            this.updateBlockView = function() {
                let that = this;
                if(that._syntenicBlocksData.length > 0) {
                    let syntenicBlocks = that._syntenicBlocksData.map(function(currBlock) {
                        return {
                            symbol: currBlock.symbol,
                            orientationMatch: currBlock.same_orientation,
                            matchAnchorPoints: {
                                refAnchorPoints: {
                                    chr: currBlock.ref_chr,
                                    startPos: currBlock.match_anchor_points.ref_anchor_points[0],
                                    endPos: currBlock.match_anchor_points.ref_anchor_points[1],
                                    size: 1 + currBlock.ref_end_pos - currBlock.ref_start_pos,
                                    anchorPoints: currBlock.match_anchor_points.ref_anchor_points,
                                    orientationMatch: currBlock.same_orientation
                                },
                                compAnchorPoints: {
                                    chr: currBlock.comp_chr,
                                    startPos: currBlock.match_anchor_points.comp_anchor_points[0],
                                    endPos: currBlock.match_anchor_points.comp_anchor_points[1],
                                    size: 1 + currBlock.comp_end_pos - currBlock.comp_start_pos,
                                    anchorPoints: currBlock.match_anchor_points.comp_anchor_points,
                                    orientationMatch: currBlock.same_orientation
                                }
                            },
                            trueAnchorPoints: {
                                refAnchorPoints: {
                                    chr: currBlock.ref_chr,
                                    startPos: currBlock.true_anchor_points.ref_anchor_points[0],
                                    endPos: currBlock.true_anchor_points.ref_anchor_points[1],
                                    size: 1 + currBlock.ref_end_pos - currBlock.ref_start_pos,
                                    anchorPoints: currBlock.true_anchor_points.ref_anchor_points,
                                    orientationMatch: currBlock.same_orientation
                                },
                                compAnchorPoints: {
                                    chr: currBlock.comp_chr,
                                    startPos: currBlock.true_anchor_points.comp_anchor_points[0],
                                    endPos: currBlock.true_anchor_points.comp_anchor_points[1],
                                    size: 1 + currBlock.comp_end_pos - currBlock.comp_start_pos,
                                    anchorPoints: currBlock.true_anchor_points.comp_anchor_points,
                                    orientationMatch: currBlock.same_orientation
                                }
                            }
                        };
                    });

                    // send gene data to filter manager
					JaxSynteny.blockViewFilterMng.loadData({
                        referenceFeatures: that._referenceGeneData,
						comparisonFeatures: that._comparisonGeneData
					});

					// render block view browser
                    that._blockViewBrowser.render({
                        species: JaxSynteny.speciesRef.getSpeciesId(),
                        referenceChrSizes: JaxSynteny.speciesRef.getChromosomeSizes(),
                        referenceToComparison: that._referenceHomologs,
                        referenceData: that._referenceGeneData,
                        comparisonData: that._comparisonGeneData,
                        homologToGenes: that._homologIds,
                        genesToHomologs: that._genesToHomologs,
                        syntenicBlocks: syntenicBlocks,
                        referenceInterval: SynUtils.parseReferenceInterval(that.getReferenceInterval())
                    });
                }
            };
        }

        /**
         * gets the current reference interval selected
         *
         * @return {string} - value from the reference genome interval input
         */
        // TODO [GIK] this method should be moved out of this class
        BlockViewManager.prototype.getReferenceInterval = function() {
            return this._input.val();
        };

        /**
         * loads gene information needed to display appropriate features 
         * 
         * @param {string} chromosome - chromosome number to load data for
         */
        BlockViewManager.prototype.loadGenesData = function(chromosome) {
            let that = this;

            that._referenceGeneData.length = 0;
            that._comparisonGeneData.length = 0;
            that._referenceHomologs = {};
            that._homologIds = {};
            that._genesToHomologs = {};

            // data about each chromosome (of the reference species)
            let list = JaxSynteny.speciesRef.getChromosomeSizes();

            // based on the selected reference chromosome, converts the
            // X, Y (and M) chromosomes to numbers for request lookup
            let chrIndex = chromosome;
            for(let i = 0; i < list.length; i++) {
                if(list[i].chr === chromosome && isNaN(Number(list[i].chr))) {
                    chrIndex = i + 1;
                }
            }

            let geneReqUrl = "./genes-in-interval/"
                    + JaxSynteny.speciesRef.getSpeciesId()
                    + "/chr" + chromosome + "-genes.json";

            $("#pre-block-view").remove();

            // used to check for duplicate comparison genes
            let comparisonGenes = [];

            $.getJSON(geneReqUrl, function(data) {
                console.log("gene data received");

                JaxSynteny.logger.logThis("loading gene data");
                that._blockViewBrowser.setBlockViewStatus("loading gene data", null);

                let referenceGenes = data.genes;
                let autoBlockIndex = 1;

                let dupesRemoved = 0;
                referenceGenes.forEach(function(gene, index) {
                    let ypos = SynUtils.calculateJitter(that._blockViewBrowser._trackHeight, gene.start_pos, SynUtils.geneHeight);
                    let homologId = (gene.homologs.length > 0) ? index : -index;
                    let autoBlockID;
                    let nextBlockPoint = autoBlockIndex * Math.pow(10, 7);

                    if(gene.start_pos < nextBlockPoint) {
                        autoBlockID = "block-" + (autoBlockIndex - 1);
                        if(gene.end_pos >= nextBlockPoint) {
                            autoBlockID += " block-" + (autoBlockIndex);
                        }
                    } else {
                        autoBlockID = "block-" + (autoBlockIndex);
                        autoBlockIndex += 1;
                    }

                    that._genesToHomologs[gene.gene_id] = [homologId];

                    // note: reference genes may be listed as having homologs,
                    // but the homologs may not appear within the comparison syntenic blocks
                    // not sure how to handle that...
                    that._homologIds[homologId] = {
                        reference: [gene.gene_id],
                        comparison: []
                    };

                    // TODO: FIX DATA TO REMOVE DUPLICATE EXONS BEFORE THEY REACH THE BROWSER SCRIPT
                    // start of temp duplicated exons fix if reference is human
                    let refExonsNoDupes;

                    if(JaxSynteny.speciesRef.getSpeciesId() === 9606) {
                        refExonsNoDupes = gene.canonical_transcript.filter(function (f, i, self) {
                            return (i === self.findIndex(function (o) {
                                return (o.start_pos === f.start_pos && o.end_pos === f.end_pos)
                            }))
                        });

                        dupesRemoved += (gene.canonical_transcript.length - refExonsNoDupes.length);
                        //console.log("Exon list reduced by " + rremoved);
                    } else {
                        refExonsNoDupes = gene.canonical_transcript;
                    }
                    // end of temp duplicated exons fix if reference is human

                    let refGeneData = {
                        chr: chromosome,
                        gene_id: gene.gene_id,
                        gene_symbol: gene.gene_symbol,
                        start_pos: gene.start_pos,
                        end_pos: gene.end_pos,
                        taxon_id: JaxSynteny.speciesRef.getSpeciesId(),
                        ypos: ypos,
                        homolog_id: homologId,
                        gene: {
                            strand: gene.strand,
                            homolog_genes: gene.homologs
                        },
                        exons: refExonsNoDupes, // TODO: should be gene.canonical_transcript once duplicates are removed from data
                        auto_block_id: autoBlockID,
                        type: gene.type
                    };

                    that._referenceGeneData.push(refGeneData);
                    that._referenceHomologs[gene.gene_id] = {
                        homolog_id: homologId,
                        homologs: []
                    };

                    // if the gene has homolog(s), gather data for comparison genes
                    if(gene.homologs.length > 0) {
                        gene.homologs.forEach(function(e) {
                            let strandMatch;
                            for(let i = 0; i < that._syntenicBlocksData.length; i++) {
                                let isRepresented = (
                                    (e.gene_start_pos >= that._syntenicBlocksData[i].comp_start_pos &&
                                    e.gene_end_pos <= that._syntenicBlocksData[i].comp_end_pos) &&
                                    e.gene_chr === that._syntenicBlocksData[i].comp_chr);

                                // if the gene is represented on the selected chromosome
                                // and isn't already in the list of comparison genes, add it
                                if (isRepresented && comparisonGenes.indexOf(e.gene_id) === -1) {
                                    let compYpos = SynUtils.calculateJitter(that._blockViewBrowser._trackHeight,
                                        e.gene_start_pos, SynUtils.geneHeight);
                                    strandMatch = (e.gene_strand === gene.strand);


                                    // TODO: FIX DATA TO REMOVE DUPLICATE EXONS BEFORE THEY REACH THE BROWSER SCRIPT
                                    // start of temp duplicated exons fix if comparison is human
                                    let exonsNoDupes;

                                    if (JaxSynteny.speciesComp.getSpeciesId() === 9606) {
                                         exonsNoDupes = e.canonical_transcript.filter(function (f, i, self) {
                                            return (i === self.findIndex(function (o) {
                                                return (o.start_pos === f.start_pos && o.end_pos === f.end_pos)
                                            }))
                                        });

                                        dupesRemoved += (e.canonical_transcript.length - exonsNoDupes.length);
                                        // console.log("Exon list reduced by " + removed);
                                    } else {
                                        exonsNoDupes = e.canonical_transcript;
                                    }
                                    // end of temp duplicated exons fix if comparison is human


                                    let compGeneData = {
                                        gene_id: e.gene_id,
                                        gene_symbol: e.gene_symbol,
                                        chr: e.gene_chr,
                                        taxon_id: e.gene_taxonid,
                                        homolog_ids: [homologId],
                                        start_pos: e.gene_start_pos,
                                        end_pos: e.gene_end_pos,
                                        ypos: compYpos,
                                        block_id: that._syntenicBlocksData[i].symbol,
                                        strand_match: strandMatch,
                                        gene: {
                                            strand: e.gene_strand,
                                            reference_homologs: [gene.gene_id] },
                                        exons: exonsNoDupes, // TODO: should be e.canonical_transcript once duplicates are removed from data
                                        auto_block_id: autoBlockID,
										type: e.type
                                    };

                                    comparisonGenes.push(e.gene_id);
                                    that._comparisonGeneData.push(compGeneData);
                                    that._referenceHomologs[gene.gene_id].homologs.push(compGeneData);
                                    that._homologIds[homologId].comparison.push(e.gene_id);

                                    if(!that._genesToHomologs[e.gene_id]) {
                                        that._genesToHomologs[e.gene_id] = [homologId];
                                    }
                                    else {
                                        that._genesToHomologs[e.gene_id].push(homologId);
                                    }
                                }
                                // if the gene already exists, add the homolog id to
                                // homolog_ids for the gene and reference gene id to
                                // reference_homologs
                                else if (isRepresented && comparisonGenes.indexOf(e.gene_id) > -1) {
                                    let loc = comparisonGenes.indexOf(e.gene_id);
                                    let selectedGene = that._comparisonGeneData[loc];
                                    let blockIDs = selectedGene.auto_block_id.split(" ");
                                    if(blockIDs.indexOf(autoBlockID) < 0) { // prevent duplicate class names
                                        selectedGene.auto_block_id += (" " + autoBlockID);
                                    }
                                    selectedGene.homolog_ids.push(homologId);
                                    selectedGene.gene.reference_homologs.push(gene.gene_id);
                                    that._homologIds[homologId].comparison.push(e.gene_id);
                                }
                            }
                        })
                    }
                });
                if(dupesRemoved > 0) {
                    console.log("!!! " + dupesRemoved + " duplicated exons removed");
                }

            }).error(function() {
                that._blockViewBrowser.setBlockViewStatus("error loading genes", "error");
                throw new Error("ERROR: Could not find genes with the given URL");
            }).complete(function() {
                that.updateBlockView();
            });
        };

        /**
         * loads synteny blocks data for the specified (reference) chromosome
         *
         * @param {string} chromosome - chromosome to load data for
         */
        BlockViewManager.prototype.loadData = function(chromosome) {
            let that = this;

            let blocksReqURL = "./syntenic-blocks/"
                + JaxSynteny.speciesRef.getSpeciesId()
                + "/" + JaxSynteny.speciesComp.getSpeciesId()
                + "/" + chromosome + "-blocks.json";

            $.getJSON(blocksReqURL, function(data) {
                console.log("block data recieved");
                if(data.blocks.length > 0) {
                    that._syntenicBlocksData = data.blocks;

                    // data successfully loaded: print message on board
                    JaxSynteny.logger.logThis("loading block data");
                    that._blockViewBrowser.setBlockViewStatus("loading data", null);

                    // get gene data
                    that.loadGenesData(that._chromosome);
                }
                else {
                    that._blockViewBrowser.setBlockViewStatus("no block data", "error");
                    throw new Error("ERROR: No block data returned");
                }
            }).fail(function() {
                that._blockViewBrowser.setBlockViewStatus("data couldn't be loaded", "error");
                throw new Error("ERROR: Data couldn't be loaded from the provided URL");
            });
        };
		
        return BlockViewManager;
	})();


	///////////////////////////////////////////////////////////////////////////
	// InputValidation Class
	///////////////////////////////////////////////////////////////////////////
	DataManager.InputValidation = (function() {
        /**
         * @constructor
         */
        function InputValidation() {
            let passedValidation = false;

            let chrInfo = {
                "chr": null,
                "size": null
            };

            this._errors = [];

            this.setValidationStatus = function(status) {
                passedValidation = status;
            };

            this.getValidationStatus = function() {
                return passedValidation;
            };

            this.setChromosomeInfo = function(chr, size) {
                chrInfo.chr = chr;
                chrInfo.size = size
            };

            this.getChromosomeInfo = function() {
                return chrInfo;
            };
        }

        /**
         * checks validity of the entered chromosome for the reference interval
         *
         * @param {string} chrNum - chromosome number
         */
        InputValidation.prototype.validChromosome = function(chrNum) {
            let that = this;
            // an array of chromosomes size information for this species
            let chrSizes = JaxSynteny.speciesRef.getChromosomeSizes();

            // reset object properties values
            that._errors.length = 0;
            that.setChromosomeInfo(null, null, null);

            for(let i = 0; i < chrSizes.length; i++) {
                if(chrSizes[i].chr === chrNum) {
                    that.setChromosomeInfo(chrSizes[i].chr, chrSizes[i].size);
                    break;
                }
            }

            let chrInfo = that.getChromosomeInfo();

            if((chrInfo.chr === null) || (chrInfo.size === null)) {
                that._errors.push("Indicated chromosome number is invalid");

                that.setValidationStatus(false);
            }
        };

        /**
         * checks validity of the entered interval for the reference interval
         *
         * @param {string} intervalChr - chromosome number
         * @param {number} intervalStart - starting position for the interval
         * @param {number} intervalEnd - ending position for the interval
         */
        InputValidation.prototype.validGenomicInterval = function(intervalChr, intervalStart, intervalEnd) {
            let that = this;
            let chrInfo = that.getChromosomeInfo();

            let isStartLessThanEnd = false;
            let isStartValid = false;
            let isEndValid = false;

            if(chrInfo.chr === null || chrInfo.size === null) {
                that.validChromosome(intervalChr);
            }

            // check that range start position is smaller than range end position
            if(intervalStart < intervalEnd) {
                isStartLessThanEnd = true;
            } else if(intervalStart === intervalEnd) {
                that._errors.push("Interval range must be at least 1");
            } else {
                that._errors.push("Interval start position must be smaller that the end position");
            }

            // check that range start position is between 0 and chromosome size value
            if((chrInfo.startPos !== null && intervalStart >= 0)
                && (chrInfo.endPos !== null && intervalStart <= chrInfo.size)) {
                isStartValid = true;
            } else {
                that._errors.push("Interval start position is invalid");
            }

            // check that range end position is between 0 and chromosome size value 
            if((chrInfo.startPos !== null && intervalEnd >= 0)
                && (chrInfo.endPos !== null && intervalEnd <= chrInfo.size)) {
                isEndValid = true;
            } else {
                that._errors.push("Interval end position is invalid");
            }

            if(isStartLessThanEnd && isStartValid && isEndValid) {
                that.setValidationStatus(true);
            }
        };

        return InputValidation;
	})();

})(DataManager || (DataManager={}));