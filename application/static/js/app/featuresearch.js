"use strict";

/**
 * @file: featuresearch.js
 * @fileOverview: classes and methods related to the feature search
 * application panel
 * @created: 02/13/2018
 * @last modified: 02/13/2018
 * @author: georgi.kolishovski@jax.org, anna.lamoureux@jax.org
 */

let FeatureSearch;

(function(FeatureSearch) {

    /**
     * ************************************************************************
     * SearchTermInput
     * NB: this class can be converted to singleton
     * ************************************************************************
     */
    FeatureSearch.SearchTermInput = (function() {
        /**
         * @constructor
         */
        function SearchTermInput() {
            this._input =  $("#searchterm");
        }

        /**
         * (search term input) autocomplete setup
         * autocomplete is implemented using Twitter TypeAhead
         * @param {any} category - selected feature search category
         */
        SearchTermInput.prototype.autocomplete = function(category) {
            this._input.typeahead("destroy");
            // typeahead's 'prefetch' option caches fetched data in browser's local 
            // storage; previously cached data must be cleared before fetching
            // the next data in order to keep the autocomplete suggestions relevant
            localStorage.removeItem("term");

            let url = null;
            let tokenizer = "term";
            let suggestions;

            if(SynUtils.indexOfObj(JaxSynteny.speciesRef.ontologies, "abbrev", category) > -1) {
                url = "./fetch-autocomplete-terms/ont/" + category + ".json";
            } else {
                url = "./fetch-autocomplete-terms/" + category + "/" + JaxSynteny.speciesRef.getSpeciesId() + ".json";
            }

            suggestions = new Bloodhound({
                    datumTokenizer: Bloodhound.tokenizers.obj.whitespace(tokenizer),
                    queryTokenizer: Bloodhound.tokenizers.whitespace,
                    prefetch: url
                });
 
            this._input.typeahead({
                    hint: true,
                    highlight: true,
                    minLength: 1
                }, {
                    name: "terms",
                    display: "term",
                    source: suggestions
                });
        };

        /**
         * sets input element placeholder attribute value
         * @param {string} v - placeholder's attribute content
         */
        SearchTermInput.prototype.setPlaceholderVal = function(v) {
            this._input.attr("placeholder", v);
        };

        /**
         * sets input element value
         * @param {string} v - input content
         */
        SearchTermInput.prototype.setVal = function(v) {
            this._input.val(v);
        };

        /**
         * returns current input value
		 * @return {string} - current input value
         */
        SearchTermInput.prototype.getVal = function() {
            return this._input.val();
        };

        /**
         * returns reference pointer to the specific dom element
         * @return this._input - element dom reference
         */
        SearchTermInput.prototype.node = function() {
            return this._input;
        };

        return SearchTermInput;
    })();


    /**
     * ************************************************************************
     * class SearchButton
     * NB: this class can be converted to singleton
     * ************************************************************************
     */
    FeatureSearch.SearchButton = (function() {
        /**
         * @constructor
         * @param {Object} featureCategory - select DOM element for the search type
         * @param {Object} searchTermInput - input DOM element for the search term
         */
        function SearchButton(featureCategory, searchTermInput) {
            // referenced html element
            this._button = $("#feature-search-btn");
            this.term = $("#searchterm");

            this._featureCategory = featureCategory;
            this._searchTermInput = searchTermInput;
            this._searchResultsTable = null;
 
            let that = this; // used in callbacks

            that._searchResultsTable = FeatureSearch.SearchResultsTable.getInstance(that); // singleton

            // remove binded behaviors from previous versions of the table, if present
            this.term.off("keyup");

            // triggers search on enter keystroke
            this.term.keyup(function(event) {
                if(event.keyCode === 13) {
                    // close the typeahead suggestions menu
                    $(".tt-menu").css("display", "none");
                    // start the search
                    that._button.click();
                }
            });

            // must remove any previously binded click node events
            // otherwise multiple clicks will be fired
            this._button.off("click");
            // button onclick event handler
            this._button.on("click", function() {
                let cat = that._featureCategory.getVal();
                let term = that._searchTermInput.getVal();
                let msg = $("#search-msg");

                // clear any current error messages
                msg.html("");

                // if no search term has been provided, display the error message for 10 sec or 
                // till the user enters some input
                if(term === "") {
                    msg.html("Search term is required");
                    setTimeout(function() { msg.html(""); }, 10000);
                }
                else {
                    // disable button (from being clicked) during searching...
                    that._button.prop("disabled", true);
                    that._button.html("Searching...");

                    that._searchResultsTable.cleanup(); // cleanup some existing dom/svg elements

                    if(cat) {
                        that._searchResultsTable.execute(new Search(cat, term));
                    } else {
                        throw new Error("Could not instantiate object.");
                    }
                }
            });

            // feature category select onchange event handler
            that._featureCategory.node().on("change", function() {
                // run cleanup: table search results, search term input text, etc...
                that._searchResultsTable.cleanup();

                // update search term input placeholder value
                that._featureCategory.update($(this).val());
            });

            // clear any error messages when the input is changed
            that._searchTermInput.node().on("input", function() {
                let msg = $("#search-msg");
                msg.html("");
            });
        }

        /**
         * returns reference pointer to the specific dom element
         * @return this._button - element dom reference 
         */
        SearchButton.prototype.node = function() {
            return this._button;
        };
		
        return SearchButton;
    })();

    let searchType = null;

    /**
     * @constructor
     *
     * @param {Object} parent - parent object
     * @param {Array} header - object array with text and ids for each object
     * @param {number} order - column index that will be ordered when table loads
     * @param {string} category - search type
     * @param {string} searchTerm - feature searched for
     * @param {Object} searchButton - search button object
     */
    function ConstructSearchTable(parent, header, order, category, searchTerm, searchButton) {

        let searchURL = "";
        // check whether the selected search type is an ontology term: ontology searches undergo special processing
        if(SynUtils.indexOfObj(JaxSynteny.speciesRef.ontologies, "abbrev", category) > -1) {
            // high-level ontology term searches may generate huge result sets and have prolonged ehecution time;
            // the script will first count all the children for those ontology entries that match the search term directly - 
            // many total children means that the search term was too general, any further search processing will be
            // interrupted and user will be prompted to enter more specialized search term.
            let ontChildCountUrl = "./count-ont-children/" + category + "/" + searchTerm + ".json";

            $.getJSON(ontChildCountUrl)
                .done(function(data) {
                    // use threshold = 500
                    if(data.num_children > 500) {
                        searchButton.node().prop("disabled", false);
                        searchButton.node().html("Search");

                        let msg = $("#search-msg");
                        // clear any current error messages
                        msg.html("");
                        // display the error message for 10 sec or 
                        // till the user enters some input
                        msg.html("Please use more specific search term");
                        setTimeout(function() { msg.html(""); }, 10000);
                    } else {
                        searchURL = "./ont-info/" + JaxSynteny.speciesRef.getSpeciesId() + "/" + category + "/" + searchTerm + ".json";
                        // call nested function
                        renderSearchFeatureTable();
                    }
                });
        } else {
            searchURL = "./" + category + "-info/" +  JaxSynteny.speciesRef.getSpeciesId() + "/" + searchTerm + ".json";
            // call nested function
            renderSearchFeatureTable();
        }

        function renderSearchFeatureTable() {
            if(searchURL !== "") {
                $.getJSON(searchURL)
                    .done(function(data) {
                        let table = d3.select("#search-result-table");

                        // create table header
                        table.append('thead')
                            .append('tr')
                            .selectAll("td")
                            .data(header)
                            .enter()
                            .append("td")
                            .attr("class", "syn-thead")
                            .attr("id", function(d) { return d.id; })
                            .html(function(d) { return d.title; });

                        // create table body rows
                        table.append('tbody')
                            .selectAll("tr")
                            .data(data)
                            .enter()
                            .append("tr")
                            .selectAll("td")
                            .data(function(d) {
                                let row = new Array(header.length);
                                row[0] = "<input type=checkbox>";

                                Object.keys(d).forEach(function(e) {
                                    let keyFound = false;
                                    let index = 0;
                                    header.forEach(function(f, j) {
                                        if(f.id === e && !keyFound) {
                                            index = j;
                                            keyFound = true;
                                        }
                                    });
                                    if(keyFound) {
                                        row[index] = d[header[index].id];
                                    }
                                });
                                return row;
                            })
                            .enter()
                            .append("td")
                            .html(function(col) {
                                return col;
                            });

                        let tableHeight;

                        // manual breakpoints as adjusting height to window width is difficult
                        if($(window).width() > 1875) {
                            tableHeight = $(window).width() * 0.28;
                        }
                        else if($(window).width() > 1665){
                            tableHeight = $(window).width() * 0.26;
                        }
                        else if($(window).width() > 1575){
                            tableHeight = $(window).width() * 0.25;
                        }
                        else if($(window).width() > 1490){
                            tableHeight = $(window).width() * 0.24;
                        }
                        else {
                            tableHeight = $(window).width() * 0.23;
                        }

                        // default dataTable properties for any kind of search
                        let tableProperties = {
                            "paging": false,
                            "scrollY": tableHeight,
                            "scrollX": true,
                            "columns": [],
                            "language": {
                                "info": "Showing _START_ to _END_ of _TOTAL_ entries"
                            },
                            "processing": true,
                            "dom": '<"top"if>rt<"bottom"><"clear">' 
                        };

                        // dataTable ordering (don't allow ordering on checkbox column)
                        for(let i = 0; i < header.length; i++) {
                            if(i === 0) {
                                tableProperties.columns.push({"orderable":false})
                            }
                            else {
                                tableProperties.columns.push(null)
                            }
                        }

                        // if there is an order, set the column index as that order value
                        if(order) {
                            tableProperties.order = [[order, "asc"]];
                        }

                        table = $("#search-result-table");

                        // create a dataTable with the computed properties
                        table.dataTable(tableProperties);

                        // dataTable HAS BEEN CREATED: bind some event handlers
                        // render button above table - initially the button is disabled
                        d3.select("#view-genome-view-top")
                            .append("button")
                            .attr("class", "custom-button view-blocks-btn")
                            .attr("type", "button")
                            .attr("disabled", "disabled")
                            .html("View");

                        // render button below table - initially the button is disabled
                        d3.select("#view-blocks-bottom")
                            .append("button")
                            .attr("class", "custom-button view-blocks-btn")
                            .attr("type", "button")
                            .attr("disabled", "disabled")
                            .style("margin-top", "0.8vw")
                            .html("View");

                        searchType = category;

                        let tableCheckboxes = table.find('tbody tr td input:checkbox');

                        tableCheckboxes.click(function() {
                            if(table.find('input:checkbox:checked').length > 0)  {
                                $(".view-blocks-btn").attr("disabled", null);
                            } else {
                                $(".view-blocks-btn").attr("disabled", "disabled");
					        }
                        });
				
                        // checkbox behavior
                        $("#search-select-all").on("click", function () {
                            let checkBoxes = table.find('tbody tr td input:checkbox');
                            if($("#search-select-all").is(':checked')) {
                                checkBoxes.prop("checked", true);
                                $(".view-blocks-btn").attr("disabled", null);
                            } else {
                                checkBoxes.prop("checked", false);
                                $(".view-blocks-btn").attr("disabled", "disabled");
                            }
                        });

                        $(".view-blocks-btn").on("click", parent.updateGenomeView);
                    })
                    .fail(function() {
                        throw new Error("Couldn't get data to display")
                    })
                    .always(function() {
                        // search has finished, enable the search button again
                        searchButton.node().prop("disabled", false);
                        searchButton.node().html("Search");
                    });
            }
        }
    }
	
    /**
     * Search
     */
    let Search = function(category, searchTerm) {
        return new SearchResult(ConstructSearchTable, category, searchTerm);
    };


    /**
     * 
     *
     */
    let SearchResult = function(execute, category, term) {
        this.execute = execute;
        this.category = category;
        this.term = term;

        d3.select("#search-result-div")
            .append("div")
            .attr("id", "search-result")
            .append("table")
            .attr("id", "search-result-table")
            .attr("class", "table table-striped table-bordered")
            .attr("width", "100%");
    };


    /**
     * ************************************************************************
     * class SearchResultsTable - singleton
	 * 
     * ************************************************************************
     */
	FeatureSearch.SearchResultsTable = (function() {
        /**
         * 
         * @param button - button object?
         * @return {*|SearchResultsTable|null}
         * @constructor
         */
        function SearchResultsTable(button) {
            this._tableNode = $("#search-result-div");
            this._searchButton = button; 

            if(SearchResultsTable._instance) {
                return SearchResultsTable._instance;
            }
            SearchResultsTable._instance = this;
        }

        /**
         * constructs and renders feature search results table;
         * table is build using DataTable.js
         * @param {Object} search - feature search
         * @param {string} search.term - search term input value
         * @param {function} search.execute - execution function
         * @param {string} search.category - the search category (i.e. 'gene', 'qtl', 'DO', ...)
         * (i.e. gene name, ontology term, QTL name)
         */
        SearchResultsTable.prototype.execute = function(search) {
            let val = null;
            if(search.term === "") { return; }

            if(SynUtils.indexOfObj(JaxSynteny.speciesRef.ontologies, "abbrev", search.category) > -1) {
                val = "ont";
            } else {
				val = search.category;
			}

            let header = null; // an array of data objects describing table headers information
            let order = null; // id of the column, which will have its data sorted alphanumerically

            switch(val) {
                case "gene":
                    header = [
                        {
                            title: "<input type=checkbox id='search-select-all'>",
                            id: "checkbox"
                        },
                        {
                            title: "Gene Symbol",
                            id: "gene_symbol"
                        },
                        {
                            title: "Gene ID",
                            id: "gene_id"
                        },
                        {
                            title: "Gene Type",
                            id: "gene_type"
                        },
                        {
                            title: "Chr",
                            id: "gene_chr"
                        },
                        {
                            title: "Start",
                            id: "gene_start_pos"
                        },
                        {
                            title: "End",
                            id: "gene_end_pos"
                        },
                        {
                            title: "Strand",
                            id: "gene_strand"
                        }
                    ];
                    order = 1;
                    break;
                case "qtl":
                    header = [
                        {
                            title: "<input type=checkbox id='search-select-all'>",
                            id: "checkbox"
                        },
                        {
                            title: "QTL ID",
                            id: "id"
                        },
                        {
                            title: "QTL Symbol",
                            id: "name"
                        },
                        {
                            title: "Chr",
                            id: "seq_id"
                        },
                        {
                            title: "Start",
                            id: "start"
                        },
                        {
                            title: "End",
                            id: "end"
                        }
                    ];
                    order = 1;
                    break;
                case "ont":
                    header = [
                        {
                            title: "<input type=checkbox id='search-select-all'>",
                            id: "checkbox"
                        },
                        {
                            title: "Term ID",
                            id: "ontology_id"
                        },
                        {
                            title: "Name",
                            id: "name"
                        },
                        {
                            title: "Gene ID",
                            id: "gene_id"
                        },
                        {
                            title: "Gene Symbol",
                            id: "gene_symbol"
                        },
                        {
                            title: "Gene Type",
                            id: "gene_type"
                        },
                        {
                            title: "Chr",
                            id: "gene_chr"
                        },
                        {
                            title: "Start",
                            id: "gene_start_pos"
                        },
                        {
                            title: "End",
                            id: "gene_end_pos"
                        },
                        {
                            title: "Strand",
                            id: "gene_strand"
                        }
                    ];
                    order = 1;
                    break;
                default:
                    console.error("invalid search type");
                    break;
            }

            new ConstructSearchTable(this, header, order, search.category, search.term, this._searchButton);
        };

        /**
         * remove some elements from page so that they do not  
         * pile-up and mess up the search results
         *
         */
        SearchResultsTable.prototype.cleanup = function() {
            this._tableNode.empty();
			$('.view-blocks-btn').remove();
        };

        /**
         * returns the jQuery selector reference
         * 
         * @return the table reference
         */
        SearchResultsTable.prototype.node = function() {
            return this._tableNode;
        };

        /**
         * updates the genome view with the selected features
         */
         SearchResultsTable.prototype.updateGenomeView = function() {
             let table = $("#search-result-table");

             // use header to create keys for each row object
             let header = [];
             table.find("thead .dataTables_sizing").each(function() {
                 if(this.innerHTML.split(" ").length > 1) {
                     header.push(this.innerHTML.split(" ")[1].toLowerCase());
                 }
                 else {
                     header.push(this.innerHTML.toLowerCase());
                 }
             });

             // create objects for each selected row using keys from header
             let rows = [];
             table.find("tbody tr").filter(":has(:checkbox:checked)").each(function() {
                 let rowData = {};
                 $(this).find('td').each(function(i) {
                     if(i !== 0) {
                         rowData[header[i]] = $(this).text();
                     }
                 });
                 rows.push(rowData);
             });

             let type = (searchType === "qtl") ?
                        "qtl" : "gene";

             // for each row, add the feature to JaxSynteny's highlightedFeatures if it's not already there
             rows.forEach(function(e) {
                 let found = false;
                 JaxSynteny.highlightedFeatures[type].forEach(function(f) {
                     if(f[type + "_id"] === e.id) {
                         found = true;
                     }
                 });

                 if(!found) {
                     let feature = {
                         chr: e.chr,
                         start_pos: e.start,
                         end_pos: e.end
                     };

                     feature[type + "_id"] = e.id;
                     feature[type + "_symbol"] = e.symbol;

                     // by pushing instead of replacing existing list, we are able to mix types of
                     // features to be displayed (e.g. genes and qtls)
                     JaxSynteny.highlightedFeatures[type].push(feature);
                 }

             });

             JaxSynteny.genomeView.identifySelectedFeatures();
        };

        /**
         * 
         * @param searchBtn - search button reference (to disable it while the search executes)
         */
        SearchResultsTable.getInstance = function(searchBtn) {
            if(!SearchResultsTable._instance) {
                SearchResultsTable._instance = new SearchResultsTable(searchBtn);
            }
            return SearchResultsTable._instance;
        };

        SearchResultsTable._instance = null;

        return SearchResultsTable;
    })();

    /**
     * ************************************************************************
     * class SearchCategories
     * TODO: make the class Singleton
     * ************************************************************************
     */
    FeatureSearch.SearchCategories = (function() {
        /**
         * creates class instance and assigns values to object members 
         * @constructor
         * @param {Object} searchTermInput - html element reference
         */
        function SearchCategories(searchTermInput) {
            let that = this;
            that._options = [];
            that._select = $("#feature-search-categories");
            that._searchTermInput = searchTermInput;
        }

        /**
         * get current search category
         */
        SearchCategories.prototype.getVal = function() {
            return this._select.val();
        };

        /**
         * loads the possible search type options for the selected species
         *
         * @param species - reference species to generate search options for
         */
        SearchCategories.prototype.populate = function(species) {
            let that = this;

            that._options = species.dataCategories;
            // clean-up current search feature categories
            that._select.find("option").remove();

            d3.select("[id=feature-search-categories]")
                .selectAll("option")
                .data(that._options)
                .enter()
                .append("option")
                .attr("value",
                    function(data) {
                        return data.name;
                    })
                .text(function(data) {
                    return (species.name + " " + data.value);
                });

            // set search term input placeholder text
            that._searchTermInput.setPlaceholderVal(that._options[0].search_example);

            // set initial search term input autocomplete feature
            that._searchTermInput.autocomplete(that._select.val());
        };

        /**
         * if user has changed to another feature categories select option (the same species) 
         * 1) update the search term input field text (insert the default placeholder text)
         * 2) bind autocomplete to the new option
         * 3) clean up all current records in the search results table
         * @param {string} val - currently selected option's value
         */
        SearchCategories.prototype.update = function(val) {
            let that = this;

            // bind change event to search term input autocomplete
            that._searchTermInput.autocomplete(val);

            // replace the existing text in the search term input field
            // with the default placeholder text for the newly selected option
            that._searchTermInput.node().val("");
            for(let i = 0; i < that._options.length; i++) {
                if(val === that._options[i].name) {
                    that._searchTermInput.setPlaceholderVal(that._options[i].search_example);
                }
            }
        };

        /**
         * returns reference to this dom node/element
         * @return {*|ui.selectmenu._select}
         */
        SearchCategories.prototype.node = function() {
            return this._select;
        };

        return SearchCategories;
    })();


})(FeatureSearch || (FeatureSearch={}));