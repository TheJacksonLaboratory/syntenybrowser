"use strict";

/**
 * @file: synblockview-filter.js
 * @fileOverview:
 * @created: 7/27/16
 * @last modified: 01/05/2017
 * @author: georgi.kolishovski@jax.org, anna.lamoureux@jax.org
 */
 
 let BlockViewFilter;
 
(function(BlockViewFilter) {
    ///////////////////////////////////////////////////////////////////////////
    // class FilterManager
    // 
    ///////////////////////////////////////////////////////////////////////////
    let FilterManager = (function() {
        /**
         * class constructor
         */
        function FilterManager(jaxSynteny) {
            // private variables
            let blockViewBrowser = jaxSynteny.dataManager._blockViewBrowser;
            // typeahead input values
            let featureSymbolsIds = [];
            let featureTypes = [];
            let ontSearchTerms = {};

            // available ontologies
            let ontologies = [];

            let matchedSymbolId = [];
            let matchedTypes = [];
            let matchedOnt = [];

            // html elements
            let clearFilterButton = $("#clear-filter-btn");
            let geneSymbolIdInput = $("#gene-symbol-id-filter-input");
            let geneTypesSelect = $("#gene-type-filter-select");
            let geneOntTermInput = $("#ont-term-filter-input");
            let numberResultsBoard = $("#filter-results-found-board");
            let ontSelect = $("#ont-filter-select");
            let resultsTable = $("#filter-results-table");
            let runFilterButton = $("#run-filter-btn");
            let selectionTermsBoard = $("#filter-selection-terms-board");

            this._chrNum = null;
            this._currOnt = ontSelect.val();
            this._featureSymbolsIdsMap = {};
            this._featureTypesMap = {};

            let matchedFeatures = []; // set of gene IDs matching the current filter requirements
            // [gik] 01/11/18 TODO: this can and should be an array
            let booleanOptions = {
                    "count": 0,
                    "order": []
                };
            // 'fc*' stands for 'FILTER CRITERIA'
            let selectionTerms = {
                "fc1": null,
                "fc2": null,
                "fc3": null
                };

            ///////////////////////////////// 
            // CLASS METHODS
            /////////////////////////////////


            /////////////////////////////////////
            // ENABLE/DISABLE USER CONTROLS
            /////////////////////////////////////
            this.enableControlElements = function() {
                enableGeneSymbolIdInput();
                enableGeneTypesSelect();
                enableOntTypeSelect();
                enableGeneOntTermInput();
                enableRunFilterButton();
                enableClearFilterButton();
            };

            function enableGeneSymbolIdInput() {
                geneSymbolIdInput.attr("disabled", false);
            }

            function enableGeneTypesSelect() {
                geneTypesSelect.attr("disabled", false);
            }

            function enableOntTypeSelect() {
                ontSelect.attr("disabled", false);
            }
			
            function enableGeneOntTermInput() {
                geneOntTermInput.attr("disabled", false);
            }

            function disableRunFilterButton(msg) {
                (msg !== null) ? runFilterButton.html(msg).attr("disabled", true) 
                    : runFilterButton.attr("disabled", true);
            }

            function enableRunFilterButton() {
                runFilterButton.html("RUN").attr("disabled", false);
            }

            function disableClearFilterButton(msg) {
                if(msg !== null) { 
                    clearFilterButton.html(msg).attr("disabled", true); 
                } else { 
                    clearFilterButton.attr("disabled", true); 
                }
            }

            function enableClearFilterButton() {
                clearFilterButton.html("CLEAR").attr("disabled", false);
            }

            // privileged getter methods
            this.getblockViewBrowser = function() { return blockViewBrowser; };
            this.getfeatureSymbolsIds = function() { return featureSymbolsIds; };
            this.getfeatureTypes = function() { return featureTypes; };
            this.getontologyMatches = function() { return matchedOnt; };
            this.getselectionTerms = function() { return selectionTerms; };
            this.getontologies = function() { return ontologies; };
            this.getontSearchTerms = function() { return ontSearchTerms; };

            this.getmatchedSymbolId = function() {
                return matchedSymbolId;
            };

            this.getmatchedTypes = function() {
                return matchedTypes;
            };

            this.setOntSelect = function() {
                ontSelect.find("option").remove();
                for(let i = 0; i < ontologies.length; i++) {
                    ontSelect.append($("<option></option>")
                        .attr("value", ontologies[i].abbrev)
                        .text(ontologies[i].name)); 
                }
                this._currOnt = ontSelect.val();
            };

            // in the case that there's an error, make sure that the run filter button is (re)enabled
            // so that filtering doesn't get stuck in limbo
            window.onerror = function() {
                enableRunFilterButton();
            };

            /**
             * 
             * @param {string[]} ontAbbrevs - ontology abbreviations such as GO for gene onotlogy
             */
            this.setOntologies = function(ontAbbrevs) {
                ontologies.length = 0;
                
                for(let i = 0; i < ontAbbrevs.length; i++) {
                    ontologies.push(ontAbbrevs[i]);
                }
            };

			/**
			*
			* @param {string} id - one of ("fc1", "fc2", "fc3")
			* @param {boolean} b - TRUE (if input value) or FALSE (if no input value)
             * @param d - data
			*/
            this.setBooleanExpOptions = function(id, b, d) {
                let change = null;

                (b === (contains(id) > -1)) ? change = false : change = true;

                if(change) {
                    b ? booleanOptions.order.push({"id": id, "data": d}) : booleanOptions.order.splice(contains(id), 1);

                    booleanOptions.count = booleanOptions.order.length;

                    let sel1 = $("#boolean-sel-1");
                    let sel2 = $("#boolean-sel-2");
                    let sel3 = $("#boolean-sel-3");

                    switch(booleanOptions.order.length) {
                        case 0:
                        case 1:
                            sel1.attr("disabled", true);
                            sel1.find("option[value='none']").prop("selected", true);
                            sel2.attr("disabled", true);
                            sel2.find("option[value='none']").prop("selected", true);
                            break;
                        case 2:
                            sel1.attr("disabled", false);
                            sel2.attr("disabled", false);

                            sel1.find("option[value='" + booleanOptions.order[0].id + "']").prop("selected", true);
                            sel2.find("option[value='" + booleanOptions.order[1].id + "']").prop("selected", true);

                            sel3.find("option[value='none']").prop("selected", true);
                            sel3.attr("disabled", true);
                            break;
                        default:
                            sel3.attr("disabled", false);
                            sel3.find("option[value='" + booleanOptions.order[2].id + "']").prop("selected", true);
                            break;
                    }
                }

                // nested function
                function contains(id) {
                    for(let i = 0; i < booleanOptions.order.length; i++) {
                        if(booleanOptions.order[i].id === id) {
                            return i;	
                        }
                    }
                    return -1;
                }
            };

            // privileged setter methods
            this.setfeatureSymbolsIds = function(a) {
                featureSymbolsIds.length = 0;

                if(a && a.length > 0) {
                    for(let i = 0; i < a.length; i++) {
                        featureSymbolsIds.push(a[i]);
                    }
                    setInputAutoComplete(this);
                }
            };

            this.setfeatureTypes = function(a) {
                featureTypes.length = 0;

                if(a && a.length > 0) {
                    for(let i = 0; i < a.length; i++) {
                        // skip "undefined", null or empty values since these cannot be select options (for now)
                        if(a[i]) {
                            if(featureTypes.indexOf(a[i]) < 0) {
                                featureTypes.push(a[i]);
                            }
                        }
                    }

                    featureTypes.sort();
                    setSelectOptions(this);
                }
            };

            this.setontSearchTerms = function(arr, ont) {
                if(!ontSearchTerms[ont]) {
                    ontSearchTerms[ont] = [];
                } else {
                    ontSearchTerms[ont].length = 0;
                }

                if(arr && arr.length > 0) {
                    for(let i = 0; i < arr.length; i++) {
                        if(arr[i]) {
                            ontSearchTerms[ont].push(arr[i]);
                        }
                    }
                }
                // setOntInputAutoComplete(ont);
            };

            this.setontMatches = function(a) {
                matchedOnt.length = 0;

                if(a && a.length > 0) {
                    for(let i = 0; i < a.length; i++) {
                        if(a[i]) {
                            matchedOnt.push(a[i]);
                        }
                    }
                }
            };

            this.setmatchedFeatures = function() {
                selectionTermsBoard.html("");
                
                // remove current matched genes/features
                matchedFeatures.length = 0;
                // remove any genes/feature highlighting in Block View
                blockViewBrowser.highlightFilteredFeatures(matchedFeatures);
                // check for boolean relationships b/n the filter selections
                matchedFeatures = runBooleanExp(matchedTypes, matchedOnt, booleanOptions);

                // update user message board information
                let selectionTermsBoardHtml = "";
                for(let i = 0; i < selectionTerms.length; i++) {
                    selectionTermsBoardHtml = selectionTermsBoardHtml + selectionTerms[i] + "<br>";
                }
 
                selectionTermsBoard.html(selectionTermsBoardHtml);
                numberResultsBoard.html("<b>matched results: (" + matchedFeatures.length + ")</b>");

                blockViewBrowser.setmatchedFilterFeatures(matchedFeatures);
                // update feature indicator panel
                blockViewBrowser.generateFeatureIndicatorPanel();
                // highlight filtered genes
                blockViewBrowser.highlightFilteredFeatures();

                // DataTable results update
                dt.rows().remove().draw();
                dt.rows.add(matchedFeatures).draw();

                // update the tracks
                blockViewBrowser.updateReferenceTrack();
                blockViewBrowser.updateComparisonTrack();

                JaxSynteny.logger.changeFilterStatus("FILTER OPERATION COMPLETE", SynUtils.finishedStatusColor);
                enableRunFilterButton();
                enableClearFilterButton();
            };

            let that = this;
            ///////////////////////////////// 
            // FILTER CONTROLS EVENT HANDLERS
            /////////////////////////////////

            FilterManager.prototype.hideNonfiltered = function() {
                blockViewBrowser.updateReferenceTrack();
                blockViewBrowser.updateComparisonTrack();
            };

            FilterManager.prototype.updateGeneSymbolInput = function() {
                let valSymbolId = geneSymbolIdInput.val();
                let matchedSymbolId =  that.getmatchedSymbolId(); // an array of currently matched features
                matchedSymbolId.length = 0; // clear previous input
                let selectionTerms = that.getselectionTerms();

                if(valSymbolId) {
                    selectionTerms["fc1"] = valSymbolId;
                    that.setBooleanExpOptions("fc1", true, matchedSymbolId);
                    let s = valSymbolId.split("-");
                    // valid input: [<gene_id> <dash> <gene_symbol>]
                    if(s.length === 2) {
                        let id = s[0].trim();

                        matchedSymbolId.push({
                            "gene_id": id
                        });
                        getFeatureInfo(that, matchedSymbolId[matchedSymbolId.length-1]);
                    }
                } else { 
                    that.setBooleanExpOptions("fc1", false, null);
                }
            };

            FilterManager.prototype.updateGeneTypeSelect = function() {
                let selectedFeatureTypes = geneTypesSelect.val();
                let matchedTypes = that.getmatchedTypes(); // an array of gene IDs that match the selected type(s)
                matchedTypes.length = 0;
                let selectionTerms = that.getselectionTerms();
                selectionTerms["fc2"] = null;

                if(selectedFeatureTypes && selectedFeatureTypes.length > 0) {
                    for(let i = 0; i < selectedFeatureTypes.length; i++) {
                        if(selectedFeatureTypes[i] === "-- no selection --") {
                            continue;
                        }
                        matchedTypes.push.apply(matchedTypes, that._featureTypesMap[selectedFeatureTypes[i]]);
                    }
                }

                if(matchedTypes.length > 0) {
                    that.setBooleanExpOptions("fc2", true, matchedTypes);
                } else {
                    that.setBooleanExpOptions("fc2", false, null);
                }
            };

            FilterManager.prototype.changeOntology = function() {
                geneOntTermInput.val("");

                setOntInputAutoComplete(that.getontSearchTerms()[ontSelect.val()]);
                that._currOnt = ontSelect.val();
            };

            FilterManager.prototype.updateGeneOntInput = function() {
                let valOnt = geneOntTermInput.val();
				let selectionTerms = that.getselectionTerms();
                // if user deletes (using backspace) any text in the input field
                if(!valOnt) {
                    that.setBooleanExpOptions("fc3", false, null);
                    that.setontMatches([]);
                    that.setmatchedFeatures();
                } else {
                    selectionTerms["fc3"] = valOnt;
                    that.setBooleanExpOptions("fc3", true, that.getontologyMatches());
                }
            };

            FilterManager.prototype.clearFilter = function() {
                let matchedSymbolId = that.getmatchedSymbolId();
                matchedSymbolId.length = 0;

                let matchedTypes = that.getmatchedTypes(); // an array of gene IDs that match the selected type(s)
                matchedTypes.length = 0;

                let matchedOnt = that.getontologyMatches();
                matchedOnt.length = 0;

                JaxSynteny.logger.changeFilterStatus("OPERATION IN PROGRESS", SynUtils.processingStatusColor);
                disableRunFilterButton(null);
                disableClearFilterButton("CLEARING...");

                $("[id=gene-symbol-id-filter-input]").val("");
                that.setBooleanExpOptions("fc1", false, null);
                $("[id=gene-type-filter-select]").val([]);
                $("[id=gene-type-filter-select] option[value='-- no selection --']").prop("selected", true);
                that.setBooleanExpOptions("fc2", false, null);
                $("[id=ont-term-filter-input]").val("");
                that.setBooleanExpOptions("fc3", false, null);

                that.setmatchedFeatures();
            };

            FilterManager.prototype.runFilter = function() {
                let ontTerm = geneOntTermInput.val();

                JaxSynteny.logger.changeFilterStatus("OPERATION IN PROGRESS", SynUtils.processingStatusColor);
                disableClearFilterButton(null);
                disableRunFilterButton("RUNNING...");

                if(ontTerm) {
                    // because getOntGenes() makes an asynchronous request
                    // to get genes mapped to this ontology term, setmatchedFeatures()
                    // has to be called within getOntGenes() once the async request is done
                    getOntGenes(that, ontTerm, that._chrNum, that._currOnt);
                } else {
                    // just call it from here otherwise
                    that.setmatchedFeatures();
                }
            };

            // DataTable properties
            let dt = resultsTable.DataTable({
                "data": matchedFeatures,
                "columns": [
                    {"data": "gene_symbol"},
                    {"data": "gene_id"},
                    {"data": "chr"},
                    {"data": "start_pos"},
                    {"data": "end_pos"},
                    {"data": "strand"}
                ],
                "scrollY": "548px",
                "language": {
                    "info": "Showing _START_ to _END_ of _TOTAL_ entries"
                },
                "buttons": [
                    { 
                        "extend": 'csvHtml5',
                        "text": "DOWNLOAD CSV",
                        "title": 'jaxsyn-data'
                    }
                ],
                "paging": false,
                "processing": true,
                "dom": '<"top"<Bf><"pull-right"i>>rt<"bottom"p><"clear">' 
            });
        }

        /**
         * loads the data used for filtering
         * @param {Object} d - features data
         * @param {Object[]} d.referenceFeatures - reference features information
         * @param {Object[]} d.comparisonFeatures - comparison features information
         */
        FilterManager.prototype.loadData = function(d) {
            let that = this;
			cleanup(that);

            let symbolIds = [];
            let types = [];
            types.push("-- no selection --"); // add select option for clearing the selection
            let goTerms = []; 
            let mpTerms = [];
            let allIds = [];

            that._featureSymbolsIdsMap = {};
            that._featureTypesMap = {};

            // reference features
            if(d.referenceFeatures.length > 0) {
                this._chrNum = d.referenceFeatures[0].chr.toString();

                let dRef = d.referenceFeatures;

                for(let i = 0; i < dRef.length; i++) {
                    allIds.push(dRef[i].gene_id);
                    symbolIds.push(dRef[i].gene_id + " - " + dRef[i].gene_symbol);
                    types.push(dRef[i].type);

                    if(that._featureTypesMap[dRef[i].type]) {
                        that._featureTypesMap[dRef[i].type].push({
                            "chr": dRef[i].chr,
                            "end_pos": dRef[i].end_pos,
                            "gene_id": dRef[i].gene_id,
                            "gene_symbol": dRef[i].gene_symbol,
                            "start_pos": dRef[i].start_pos, 
                            "strand": dRef[i].gene.strand,
                            "species": "r"
                        });
                    } else {
                        that._featureTypesMap[dRef[i].type] = [];
                        that._featureTypesMap[dRef[i].type].push({
                            "chr": dRef[i].chr,
                            "end_pos": dRef[i].end_pos,
                            "gene_id": dRef[i].gene_id,
                            "gene_symbol": dRef[i].gene_symbol,
                            "start_pos": dRef[i].start_pos, 
                            "strand": dRef[i].gene.strand,
                            "species": "r"
                        });
                    }
                }
            }

            // comparison features
            if(d.comparisonFeatures.length > 0) {
                let dComp = d.comparisonFeatures;

                for(let i = 0; i < dComp.length; i++) {
                    allIds.push(dComp[i].gene_id);
                    symbolIds.push(dComp[i].gene_id + " - " + dComp[i].gene_symbol);
                    types.push(dComp[i].type);

                    if(that._featureTypesMap[dComp[i].type]) {
                        that._featureTypesMap[dComp[i].type].push({
                            "chr": dComp[i].chr,
                            "end_pos": dComp[i].end_pos,
                            "gene_id": dComp[i].gene_id,
                            "gene_symbol": dComp[i].gene_symbol,
                            "start_pos": dComp[i].start_pos, 
                            "strand": dComp[i].gene.strand,
                            "species": "c",
							"block_id": dComp[i].block_id
                        });
                    } else {
                        that._featureTypesMap[dComp[i].type] = [];
                        that._featureTypesMap[dComp[i].type].push({
                            "chr": dComp[i].chr,
                            "end_pos": dComp[i].end_pos,
                            "gene_id": dComp[i].gene_id,
                            "gene_symbol": dComp[i].gene_symbol,
                            "start_pos": dComp[i].start_pos, 
                            "strand": dComp[i].gene.strand,
                            "species": "c",
							"block_id": dComp[i].block_id
                        });
                    }
                }
            }

            // load gene ontologies typeahead terms
            // gik [01/07/18] TODO: ontologies don't have to be read from the database each time the chromosome changes
            // since the ontology does not change when chromosome change
            let onts = that.getontologies();
            let count = 0;
            for(let i = 0; i < onts.length; i++) {
                let terms = [];
                let srcUrl = "./fetch-autocomplete-terms/ont/" + onts[i].abbrev + ".json";

                $.getJSON(srcUrl, function(data) {
                    data.forEach(function(d) {
                        terms.push(d.term);
                    });
                    that.setontSearchTerms(terms, onts[i].abbrev);
                    count++;
                }).fail(function() {
                    JaxSynteny.logger.changeFilterStatus("LOADING ONTOLOGIES FAIL", SynUtils.errorStatusColor);
                }).always(function() {
                    // that.setontSearchTerms(terms, onts[i].abbrev);
                    if(count >= onts.length) {
                        setOntInputAutoComplete(that.getontSearchTerms()[onts[0].abbrev]);
                    }
                });
            }

            that.setfeatureSymbolsIds(symbolIds);
            that.setfeatureTypes(types);

            // data has been loaded, enable control elements
            this.enableControlElements();
        };


        FilterManager.prototype.showOnlyFilteredFeatures = function() {
            return $("#hide-genome-features-cb").is(":checked");
        };


        /**
         * deletes data (from data structures used for filtering)
         * @param {Object} that - reference to the current instance
         */
        function cleanup(that) {
            // clear the data arrays from any previously stored data
            that.setfeatureSymbolsIds([]);
            that.setfeatureTypes([]);

            // clear html element values
            $("#gene-symbol-id-filter-input").val("");
            $("#gene-type-filter-select").find().remove();
            $("#ont-term-filter-input").val("");

            // gik [01/07/18] TODO: (optional) clear the DataTable
        }


        /**
         * @param {Object} that 
         * @param {string} featureId - gene id of gene to get homolog id(s) for
         * @param {Object} a - object array with homolog info
         * @return {Array} - for reference will return list of one id; for comparison,
         *                   will return the list of ids
         */
        function getFeatureHomologInfo(that, featureId, a) {
            // [gik] 01/10/18 TODO: 
            // JaxSynteny.dataManager._referenceGeneData - set private and access via method
            // JaxSynteny.dataManager._homologIds - set private and access via method
            let index = JaxSynteny.dataManager._genesToHomologs[featureId];
            // homplog ids - genes are supposed to have one homolog, but just in case use an array
            let homologIds = JaxSynteny.dataManager._homologIds[index].comparison;
            // [gik] 01/10/18 TODO: set private and access via method
            let d = JaxSynteny.dataManager._comparisonGeneData;
			
            homologIds.forEach(function(id) {
                for(let i = 0; d.length; i++) {
                    if(d[i].gene_id === id) {
                        a.push({
                            "chr": d[i].chr,
                            "end_pos": d[i].end_pos,
                            "gene_id": d[i].gene_id,
                            "gene_symbol": d[i].gene_symbol,
                            "start_pos": d[i].start_pos, 
                            "strand": d[i].gene.strand,
                            "species": "c",
							"block_id": d[i].block_id
                        });
                        break;
                    }
                }
            });
        }


        /**
         * takes an object with just one property - o.gene_id - and appends additional properties 
         * to the same object
		 * @param {Object} that - instance reference
         * @param {Object} o - an object with one property: { o.gene_id }
         */
        function getFeatureInfo(that, o) {
            // TODO: [gik] 01/04/18 - implement a dictionary/map for gene information look-ups instead of iterating 
            let dataRef = JaxSynteny.dataManager._referenceGeneData;
            for(let i = 0; i < dataRef.length; i++) {
                if(o.gene_id === dataRef[i].gene_id) { 
                    o["chr"] = dataRef[i].chr;
                    o["end_pos"] = dataRef[i].end_pos;
                    o["gene_symbol"] = dataRef[i].gene_symbol;
                    o["start_pos"] = dataRef[i].start_pos; 
                    o["strand"] = dataRef[i].gene.strand;
                    o['species'] = "r";
                    // exit loop if found
                    break;
                }
            }

            let dataComp = JaxSynteny.dataManager._comparisonGeneData;
            for(let i = 0; i < dataComp.length; i++) {
                if(o.gene_id === dataComp[i].gene_id) { 
                    o["chr"] = dataComp[i].chr;
                    o["end_pos"] = dataComp[i].end_pos;
                    o["gene_symbol"] = dataComp[i].gene_symbol;
                    o["start_pos"] = dataComp[i].start_pos; 
                    o["strand"] = dataComp[i].gene.strand;
                    o["species"] = "c";
                    o["block_id"] = dataComp[i].block_id;
                    // exit loop if found
                    break;
                }
            }
        }


        function getOntGenes(that, searchTerm, chromosome, ont) {
            let searchURL = "./ont-info/" + JaxSynteny.speciesRef.getSpeciesId() + "/" + ont + "/" + searchTerm + ".json";

            let matchedOntFeatures = [];
            $.getJSON(searchURL)
                .fail(function() {
                    JaxSynteny.logger.changeFilterStatus("problem getting ontologies", SynUtils.errorStatusColor);
                }).done(function(data) {
                    data.forEach(function(d) {
                        if(d.gene_chr === chromosome) {
                            // [gik] 01/01/18: TODO in "data" change "data.gene_chr" to "data.chr" for consistency with other parts of the code;
                            matchedOntFeatures.push({
                                "chr": d.gene_chr,
                                "end_pos": d.gene_end_pos,
                                "gene_id": d.gene_id,
                                "gene_symbol": d.gene_symbol,
                                "start_pos": d.gene_start_pos, 
                                "strand": d.gene_strand,
                                "species": "r"
                            });

                            getFeatureHomologInfo(that, d.gene_id, matchedOntFeatures);
                        }
                    });
                    that.setontMatches(matchedOntFeatures);
                    that.setmatchedFeatures();
                });
        }


        /**
         * reads user control settings and applies the rules to the passed three arrays
		 *
         * @param operandsData - ...
         * @param {Object[]} matchedTypes - an array of features that match the selected feature type(s) 
         * @param {Object[]} matchedOnt - an array of features that match the selected ontology term
         */
        function runBooleanExp(matchedTypes, matchedOnt, operandsData) {
            let res = [];

            let cbValType = $("input:radio[name='gene-type-filter-radio']:checked").val();
            let cbValOnt = $("input:radio[name='ont-filter-radio']:checked").val();

            // current boolean operators
            let boolOp1 = $("input:radio[name='boolean-op-group-1']:checked").val();
            let boolOp2 = $("input:radio[name='boolean-op-group-2']:checked").val();

            // check if user has selected to look at only reference or comparison features
            // Feature Types selection
            let  rcmt = null;
            if(cbValType === "ref") {
                rcmt = matchedTypes.filter(function(e) {
                    return e.species === "r";
                });
            }

            if(cbValType === "comp") { 
                rcmt = matchedTypes.filter(function(e) {
                    return e.species === "c";
                });
            }

            for(let i = 0; i < operandsData.order.length; i++) {
                if(operandsData.order[i].id === "fc2") {
                    if(rcmt) {
                        operandsData.order[i].data = rcmt;
                    } else {
                        operandsData.order[i].data = matchedTypes;
                    }
                    break;
                }
            }

            // ontology type and ontology term input
            let rcmo = null;
            if(cbValOnt === "ref") {
                rcmo = matchedOnt.filter(function(e) {
                    return e.species === "r";
                });
            }

            if(cbValOnt === "comp") {
                rcmo = matchedOnt.filter(function(e) {
                    return e.species === "c";
                });
            }

            for(let i = 0; i < operandsData.order.length; i++) {
                if(operandsData.order[i].id === "fc3") {
                    if(rcmo) {
                        operandsData.order[i].data = rcmo;
                    } else {
                        operandsData.order[i].data = matchedOnt;
                    }
                    break;
                }
            }

            if(operandsData.order.length === 1) {
                for(let i = 0; i < operandsData.order[0]["data"].length; i++) {
                    res[i] = operandsData.order[0]["data"][i];
                }
            } else if(operandsData.order.length === 2) {
                if(boolOp1 === "or-bool1") {
                    res = union(operandsData.order[0]["data"], operandsData.order[1]["data"]);
                } else {
                    res = intersect(operandsData.order[0]["data"], operandsData.order[1]["data"]);
                }
            } else if(operandsData.order.length === 3) {
                if(boolOp1 === "or-bool1" && boolOp2 === "or-bool2") {
                    // case: (op1 OR op2) OR op3
                    let u = union(operandsData.order[0]["data"], operandsData.order[1]["data"]);
                    res = union(u, operandsData.order[2]["data"]);
                } else if(boolOp1 === "or-bool1" && boolOp2 === "and-bool2") {
                    // case: (op1 AND op2) OR op3
                    let set = intersect(operandsData.order[0]["data"], operandsData.order[1]["data"]);
                    res = union(set,  operandsData.order[2]["data"]);
                } else if(boolOp1 === "and-bool1" && boolOp2 === "or-bool2") {
                    // case: (op1 OR op2) AND op3
                    let u = union(operandsData.order[0]["data"], operandsData.order[1]["data"]);
                    res = intersect(u, operandsData.order[2]["data"]);
                } else {
                    // case: (op1 AND op2) AND op3
                    let arrays = [operandsData.order[0]["data"], 
                                      operandsData.order[1]["data"], 
                                      operandsData.order[2]["data"]];
                    res = arrays.shift().filter(function(v) {
                        return arrays.every(function(a) {
                            return a.indexOf(v) !== -1;
                        });
                    });
                }
            }

            return res;
        }
		
		// [gik] 01/11/18 TODO: move to utils module
        function intersect(a, b) {
			let set = [];

            for(let i = 0; i < a.length; i++) {
                for(let j = 0; j < b.length; j++) {
                    if(a[i].gene_id === b[j].gene_id) {
                        set.push(a[i]);   
                    }
                }
            }
            return set;
        }

		// [gik] 01/11/18 TODO: move to utils module
        function union(a, b) {
            let u = [];

            for(let i = 0; i < a.length; i++) {
                u[i] = a[i];
            }

            for(let i = 0; i < b.length; i++) {
                for(let j = 0; j < a.length; j++) {
                    if(b[i].gene_id === a[j].gene_id) {
                        break;
                    }
                    if(j === (a.length-1)) {
                        u.push(b[i]);
                    }
                }
            }

            return u;
        }

        /**
         * function: populates the typeahead suggestions list for the gene ID or symbol input 
         * @param {Object} that - instance reference
         */
        function setInputAutoComplete(that) {
            let input = $("#gene-symbol-id-filter-input");
            input.typeahead("destroy");

            let featureSymbolsIds = that.getfeatureSymbolsIds();

            if(featureSymbolsIds.length > 0) {
                let symbol_id_suggestions = new Bloodhound({
                    datumTokenizer: Bloodhound.tokenizers.whitespace,
                    queryTokenizer: Bloodhound.tokenizers.whitespace,
                    local: featureSymbolsIds
                });

                input.typeahead({
                    hint: true,
                    highlight: true,
                    minLength: 1
                }, 
                {
                    name: 'symbol_id_suggestions',
                    source: symbol_id_suggestions
                });
            }
        }


        /**
         * function: populates the typeahead suggestions list for the ontology terms input 
         * @param {Object} data - ontology terms
         */
        function setOntInputAutoComplete(data) {
            let input = $("#ont-term-filter-input");
            input.typeahead("destroy");

            let ontTerms = data;

            if(ontTerms.length > 0) {
                let ont_terms_suggestions = new Bloodhound({
                    datumTokenizer: Bloodhound.tokenizers.whitespace,
                    queryTokenizer: Bloodhound.tokenizers.whitespace,
                    local: ontTerms
                });

                input.typeahead({
                    hint: true,
                    highlight: true,
                    minLength: 1
                }, 
                {
                    name: 'ont_terms_suggestions',
                    source: ont_terms_suggestions
                });
            }
        }


        /**
         * function: popuates the list of available options for the gene type multi-select control
         * @param {Object} that - instance reference
         */
        function setSelectOptions(that) {
            let options = that.getfeatureTypes();

            $("#gene-type-filter-select").find().remove();
            // setup the select's options
            d3.select("[id=gene-type-filter-select]")
                .selectAll("option")
                .data(options)
                .enter()
                .append("option")
                .attr("value",
                    function(data) {
                        return data;
                    })
                .text(function(data) { 
					let t = data;
					if(that._featureTypesMap[data]) {
                        t = t + " (" + that._featureTypesMap[data].length + ")"; 
                    }
                    return t;
                });

            $('#gene-type-filter-select > option[value="-- no selection --"]').attr("selected", "selected");
        }
		
        return FilterManager;
    })();

    BlockViewFilter.FilterManager = FilterManager;

})(BlockViewFilter || (BlockViewFilter={}));