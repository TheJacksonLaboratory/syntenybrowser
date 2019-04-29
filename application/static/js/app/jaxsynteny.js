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
});
