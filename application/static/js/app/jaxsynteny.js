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
        // 
        // search term input, feature search categories, search button
        let searchTermInput = new FeatureSearch.SearchTermInput();

        let searchCategoriesSelect = new FeatureSearch.SearchCategories(searchTermInput);
        searchCategoriesSelect.populate(JaxSynteny.speciesRef);

        new FeatureSearch.SearchButton(searchCategoriesSelect, searchTermInput);

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
                JaxSynteny.blockViewFilterMng.getblockViewBrowser().cleanUp();
            }
        }).error(function() {
            throw new Error("ERROR: Could not load the color scheme");
        });


        // updates to Block View Filter Panel elements and properties
        JaxSynteny.blockViewFilterMng.setOntologies(
            JaxSynteny.speciesRef.ontologies);

        JaxSynteny.blockViewFilterMng.setOntSelect();

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
});
