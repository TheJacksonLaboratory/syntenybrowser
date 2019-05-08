"use strict";

/**
 * @file: jaxsynteny.js
 * @fileOverview: application bootstrap file
 * @created: 11/28/2017
 * @last modified: 02/13/2018
 * @author: georgi.kolishovski@jax.org, anna.lamoureux@jax.org
 */

let JaxSynteny;

(function(JaxSynteny) {
    ///////////////////////////////////////////////////////////////////////////
    // ReferenceSpecies class
    // [gik] 02/13/18 this class is not used currently, but let's keep it for later usage
    ///////////////////////////////////////////////////////////////////////////
    JaxSynteny.ReferenceSpecies = (function() {
        /**
         * constructor
         */
        function ReferenceSpecies() { }
        return ReferenceSpecies;
    })();


    ///////////////////////////////////////////////////////////////////////////
    // ComparisonSpecies class
    // [gik] 02/13/18 this class is not used currently, but let's keep it for later usage
    ///////////////////////////////////////////////////////////////////////////
    JaxSynteny.ComparisonSpecies = (function() {
        /**
         * constructor
         */
        function ComparisonSpecies() { }
        return ComparisonSpecies;
    })();


    /**
     * main application bootstrap function:
     * creates several (singleton) objects that are used throughout
     * the application and invokes the JaxSynteny.setup() method
     */
    JaxSynteny.run = function() {
        // logging manager object instance (TODO: [gik] 01/05/18 make Singleton class)
        JaxSynteny.logger = new Logger.Log();
        // data manager object instance (TODO: [gik] 01/05/18 make Singleton class)
        JaxSynteny.dataManager = new DataManager.BlockViewManager();
        // overlay right panel object instance (TODO: [gik] 01/05/18 make Singleton class)
        JaxSynteny.panel = new AppControls.RightOverlayPanel(JaxSynteny);
        // block view filter manager instance (TODO: [gik] 01/13/18 make Singleton class)
        JaxSynteny.blockViewFilterMng = new BlockViewFilter.FilterManager(JaxSynteny);

        JaxSynteny.setup();
    };


    /**
     * setup elements and properties during application's run:  
     * the method tracks and updates different application variables  
     * and structures depending on user operation and interaction
     */
    JaxSynteny.setup = function() {
        // config file name: reference species
        let refFileName = $("#ref-genome-select")
            .children("option")
            .filter(":selected")
            .val() + "_config.json";

        // config file name: comparison species
        let compFileName = $("#comp-genome-select")
            .children("option")
            .filter(":selected")
            .val() + "_config.json";

        JaxSynteny.speciesRef = new Species.Species(refFileName);
        JaxSynteny.speciesComp = new Species.Species(compFileName);

        // updates to Feature Search Panel elements and properties

        // search term input, feature search categories, search button
        JaxSynteny.searchTerm = new FeatureSearch.SearchTermInput();

        JaxSynteny.searchType = new FeatureSearch.SearchCategories(JaxSynteny.searchTerm);
        JaxSynteny.searchType.populate(JaxSynteny.speciesRef);

        JaxSynteny.searchButton = new FeatureSearch.SearchButton(JaxSynteny.searchType, JaxSynteny.searchTerm);

        JaxSynteny.highlightedFeatures = {
            qtl: [],
            gene: []
        };

        // updates to Block View Panel elements and properties 
        let blockURL = "./syntenic-blocks/" + JaxSynteny.speciesRef.getSpeciesId() +
                       "/" + JaxSynteny.speciesComp.getSpeciesId() + "/blocks.json";

        // get color scheme for comparison genome
        $.getJSON("/ChrColorScheme.json", function(data) {
            let colorsComp = [];

            JaxSynteny.speciesComp.getChromosomeSizes().forEach(function(e, i) {
                colorsComp.push({
                    "chr": e.chr,
                    "color": data[e.chr]
                });
            });

            JaxSynteny.colors = colorsComp;

            JaxSynteny.genomeView = new GenomeView.DataManager(blockURL);

            // make sure that the block view is cleared
            if(JaxSynteny.blockViewFilterMng.getblockViewBrowser()) {
                JaxSynteny.blockViewFilterMng.cleanup();
                JaxSynteny.blockViewFilterMng.getblockViewBrowser().cleanUp();
            }
        }).error(function() {
            throw new Error("ERROR: Could not load the color scheme");
        });


        // updates to Block View Filter Panel elements and properties
        JaxSynteny.blockViewFilterMng.updateOntologies(getCommonOntologies());

        $(document).ajaxStop(function() { });
    }
})(JaxSynteny || (JaxSynteny={}));

// start application execution
$(function() {
    JaxSynteny.run();

    // NOTE: this needs to be out here. it used to be in the genome view AND
    // the data manager script but since the genome view is instantiated each
    // time the reference species is changed, the click event is also
    // reinstantiated resulting in the click event being triggered once for
    // each time the reference species has been changed (which causes the
    // multiple sets of AJAX calls, multiple loads of the block view, and
    // often results in the block view stalling and/or erroring out)
    $("#show-block-view").on("click", function() {
        let msg = $("#genome-msg");
        msg.html("");

        // if there is a interval present update the reference
        if($("#ref-genome-interval").val() !== "") {
            JaxSynteny.dataManager.loadBlockViewBrowser();
        }
        else {
            msg.html("A selection hasn't been made");
            setTimeout(function() { msg.html(""); }, 10000);
        }
    });


    // Feature search event handling
    $("#searchterm").keyup(function(event) {
        if(event.keyCode === 13) {
            // close the typeahead suggestions menu
            $(".tt-menu").css("display", "none");
            $("#feature-search-btn").click();
        }
    });

    $("#searchterm").on("input", function() {
        $("#search-msg").html("");
    });

    $("#feature-search-btn").on("click", function() {
        JaxSynteny.searchButton.search()
    });

    $("#feature-search-categories").on("change", function() {
        JaxSynteny.searchButton.updateCategory();
    });


    // Genome View event handling
    $("#save-genome-view").on("click", function() {
        JaxSynteny.genomeView.downloadGenomeView();
    });

    $("#clear-genome-view").on("click", function() {
        JaxSynteny.genomeView.genomeView.clearGenomeView();
    });


    // Block view browser event handling
    $("#save-block-view").on("click", function() {
        JaxSynteny.blockViewFilterMng.getblockViewBrowser().downloadBrowser();
    });


    // Block view filtering event handling
    $("#data-status-board-filter").on("click", function(event) {
        event.preventDefault();

        JaxSynteny.logger.openLog();
    });

    $("#hide-genome-features-cb").on("change", function() {
        JaxSynteny.blockViewFilterMng.hideNonfiltered();
    });

    $("#gene-symbol-id-filter-input").on("change keyup copy paste cut", function() {
        JaxSynteny.blockViewFilterMng.updateGeneSymbolInput();
    });

    $("#gene-type-filter-select").on("change", function() {
          JaxSynteny.blockViewFilterMng.updateGeneTypeSelect();
    });

    $("#ont-filter-select").on("change", function() {
          JaxSynteny.blockViewFilterMng.changeOntology();
    });

    $("#ont-term-filter-input").on("change keyup copy paste cut", function() {
        JaxSynteny.blockViewFilterMng.updateGeneOntInput();
    });

    $("#clear-filter-btn").on("click", function() {
        JaxSynteny.blockViewFilterMng.clearFilter();
    });

    $("#run-filter-btn").on("click", function() {
        JaxSynteny.blockViewFilterMng.runFilter();
    });

    $(".ont-radio input").on("change", function(e) {
        let changeTo = e.target.value;

        if(changeTo === 'comp') {
            JaxSynteny.blockViewFilterMng.updateOntologies(JaxSynteny.speciesComp.ontologies);
        } else if(changeTo === 'ref') {
            JaxSynteny.blockViewFilterMng.updateOntologies(JaxSynteny.speciesRef.ontologies);
        } else if(changeTo === 'both') {
            JaxSynteny.blockViewFilterMng.updateOntologies(getCommonOntologies());
        }
    });
});

function getCommonOntologies() {
        let refAbbrevs = JaxSynteny.speciesRef.ontologies.map(function(o) { return o.abbrev; });
        let compAbbrevs = JaxSynteny.speciesComp.ontologies.map(function(o) { return o.abbrev; });

        let bothAbbrevs = refAbbrevs.filter(function(o) { return compAbbrevs.indexOf(o) >= 0; });
        return bothAbbrevs.map(function(a) {
            // there should only be one match
            return JaxSynteny.speciesRef.ontologies.filter(function(o) { return o.abbrev === a; })[0];
        });
    }
