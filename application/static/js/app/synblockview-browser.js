"use strict";

/**
 * @file manages the rendering and operation of the block view browser
 */

let BlockView;

(function(BlockView) {
    ///////////////////////////////////////////////////////////////////////////
	// BlockViewBrowser Class
	///////////////////////////////////////////////////////////////////////////
    BlockView.BlockViewBrowser = (function() {
        // private class members
        let referenceSpecies = {};
        let comparisonSpecies = {};
        let format = d3.format(",");

        /**
         * @constructor
         */
        function BlockViewBrowser() {
            // private variables
            let matchedFeatures = [];
			let matchedFeaturesId = [];
			let matchedFeatureHomologs = [];
			let that = this;

            this.getmatchedFilterFeatures = function() {
                return matchedFeatures;
            };
			
			this.getmatchedFilterFeaturesId = function() {
				return matchedFeaturesId;
			};

			this.getmatchedFilterFeatureHomologs = function() {
                return matchedFeatureHomologs;
            };

            this.setmatchedFilterFeatures = function(filteredFeatures) {
                matchedFeatures.length = 0;
				matchedFeaturesId.length = 0;
				matchedFeatureHomologs.length = 0;
                if(filteredFeatures && filteredFeatures.length > 0) {
                    filteredFeatures.forEach(function(feature) {
                        matchedFeatures.push(feature);
                        matchedFeaturesId.push(feature.gene_id);
                        if(feature.species === "r") {
                           that._genesToHomologs[feature.gene_id].forEach(function(e) {
                                if(e >= 0) {
                                    that._comparisonGenes.filter(function(f) {
                                        return f.homolog_ids.indexOf(e) >= 0;
                                    }).forEach(function(f) {
                                        matchedFeatures.push(f);
                                        matchedFeaturesId.push(f.gene_id);
                                    });
                                }
                                matchedFeatureHomologs.push(e);
                            });
                        } else {
                            that._referenceGenes.filter(function(f) {
                                let homs = f.gene.homolog_genes;
                                return homs.length > 0 &&
                                    homs.map(function(h) { return h.gene_id; }).indexOf(feature.gene_id) >= 0;
                            }).forEach(function(f) {
                                f.species = "r";
                                matchedFeatures.push(f);
                                matchedFeaturesId.push(f.gene_id);

                                matchedFeatureHomologs.push(f.homolog_id);
                            });
                        }
                    });
                }
            };

            // set the proportions for the block view browser
            // this is in lieu of setting the height to 450px and width to 1200px, which allows us
            // to make the svg scalable
            this._width = $("#svg-container").width();
            this._height = this._width * (4.5 / 12);

            // make block view browser scalable
            this._blockView = d3.select("#block-view-svg")
                .attr("preserveAspectRatio", "xMinYMin meet")
                .attr("viewBox", ("0 0 " + this._width + " " + this._height));

            this._checkboxShowLabels = $("#bv-show-gene-symbols");
            this._checkboxShowAnchors = $("#bv-show-anchors");

            this._syntenicBlocks = [];
            this._anchorPoints = ($("#bv-true-orientation").is(":checked")) ? 'trueAnchorPoints' : 'matchAnchorPoints';

            this._refOverviewHeight = this._height * 0.2;
            this._referenceOffsetY = this._height * 0.35;
            this._trackHeight = this._height * 0.25;
            this._comparisonOffsetY = this._height * 0.65;

            this._referenceInterval = null;
            this._highlightedGenes = [];
            this._highlightedQTLs = [];

            this._refBlockTip = null;
            this._compBlockTip = null;
            this._indicatorTip = null;
            this._geneTip = null;

            this._clickedGene = null;

            this._anchorPathCommands = [];
            this._transAnchorPathCommands = []; // transformed path values

            // change these to affect how drastic zooms or pans by nav-buttons are
            this._preferences = {
                pan: 0.5,
                zoom: {
                    in: 3/4,
                    out: 4/3
                },
                minWidth: 200000
            };

            this._zoomTracks = null; // reference chromosome zoom (and pan) behavior
            this._zoomOverlay = null; // scroll select zoom behavior object

            // privileged getter methods
            // [gik] 10/22/17 TODO: _referenceInterval should be turned into private variable
            this.getReferenceInterval = function() {
                return this._referenceInterval;
            };

            this.getmatchedFilterFeatures = function() {
                return matchedFeatures;
            };

            this.getmatchedFilterFeaturesId = function() {
                return matchedFeaturesId;
            };
			
            /**
             * privileged method: sets the reference interval object's properties
             *
             * @param {Object} interval - interval to set
             * @param {string} interval.chr - chromosome interval is on
             * @param {string} interval.startPos - interval starting position
             * @param {string} interval.endPos - interval ending position
             * @param {string} interval.size - width of interval in base pairs
             */
            //TODO [GIK 10/22/17]: _referenceInterval should be turned into private variable
            this.setReferenceInterval = function(interval) {
                if(this._referenceInterval !== null) {
                    this._referenceInterval.chr = interval.chr;
                    this._referenceInterval.startPos = interval.startPos;
                    this._referenceInterval.endPos = interval.endPos;
                    this._referenceInterval.size = interval.size;
                }
            };

            this.setBlockSelector = function() {
                let interval = this._referenceInterval;

                // get the maximum number of blocks in the chromosome
                let maxAutoBlocks = Math.floor(this.calculateMaxBase() / Math.pow(10, 7)) + 1;
                let intStart = interval.startPos;
                let intEnd = interval.endPos;

                // get the start and end blocks
                let startBlock = Math.floor(intStart / Math.pow(10, 7));
                let endBlock = Math.floor(intEnd / Math.pow(10, 7));

                // generate the list of blocks that are visible
                let blocks = [];
                for(let i = startBlock; i <= endBlock; i++) {
                    blocks.push("block-" + i)
                }

                // using the * selector will make selecting visible items faster than selecting by many classes
                let selector = "g";

                // if the number of visible blocks (the array) matches the maximum, the selector should remain at "*"
                if(blocks.length !== maxAutoBlocks) {
                    selector = "g." + blocks.join(", g.")
                }

                this.blockSelector = selector;
            };

            /////////////////////////////////////////
            // BLOCK VIEW CONTROLS EVENT HANDLERS
            /////////////////////////////////////////
            // when the window changes size, since panel size won't adjust, adjust it manually
            window.onresize = that.resizeBlockViewPanel;
        }

        // gather input from user and export svg to png file with entered name
        BlockViewBrowser.prototype.downloadBrowser = function() {
            let thisButton = $("#save-block-view");

                //disable button and change state
                thisButton.prop("disabled", true);
                thisButton.html("Downloading...");

                let blockViewHeight = d3.select("#block-view-svg").attr("viewBox").split(" ")[3];

                d3.select("#block-view-svg").append("text")
                    .attr("id", "block-view-citation")
                    .attr("transform", "translate(10, " + (blockViewHeight - 5) + ")")
                    .style("font-size", 12)
                    .text("JAX Synteny Browser, The Jackson Laboratory, http://syntenybrowserpublic.jax.org/");

                // get svgs
                let blockViewSVG = document.getElementById("block-view-svg");
                let blockViewLegend = document.getElementById("chr-color-legend");

                // get user's file name
                let enteredFileName = $("#block-file-name").val();

                // without this timeout, the wait will still be there for the download but the button won't have a
                // chance to change states before the UI gets locked for the saving process
                setTimeout(function() {
                    // set the background color to white on this one since there are "invisible" elements
                    // that are white
                    saveSvgAsPng(blockViewSVG, (enteredFileName + ".png"), {backgroundColor: "white"});
                    saveSvgAsPng(blockViewLegend, (enteredFileName + "-legend.png"));

                    d3.select("#block-view-citation").remove();

                    // hide modal after save
                    $("#block-set-file-name").modal("hide");

                    //re-enable button and change state
                    thisButton.prop("disabled", false);
                    thisButton.html("Save");
                }, 500);
        };

        ////////////////////////////////////////////////////////////////////////
        // Set Up
        ////////////////////////////////////////////////////////////////////////
        /**
         * sets the reference and comparison species: id and name attributes
         */
        BlockViewBrowser.prototype.getSpecies = function() {
            referenceSpecies.id = JaxSynteny.speciesRef.getSpeciesId();
            referenceSpecies.name = JaxSynteny.speciesRef.name;

            comparisonSpecies.id = JaxSynteny.speciesComp.getSpeciesId();
            comparisonSpecies.name = JaxSynteny.speciesComp.name;
        };

        /**
         * resizes the block view panel to fit the scalable content
         */
        BlockViewBrowser.prototype.resizeBlockViewPanel = function() {
            let newHeight = $("#block-view-svg").height() + $("#color-key").height() + 80;
            $("#block-view-panel-body").height(newHeight);
        };

        /**
         * assigns space for children of the blockView
         */
        BlockViewBrowser.prototype.drawGroupElements = function() {
            let that = this;

            // create reference overview space
            that._referenceOverview = that._blockView
                .append("g")
                .attr("id", "reference-overview")
                .attr("transform", "translate(0, 0)");

            // create reference coordinates space
            that._referenceCoordinates = that._blockView
                .append("g")
                .attr("id", "ref-coordinates")
                .attr("transform", "translate(1," + (that._referenceOffsetY - 2) +")");

            // create reference block coordinates space
            that._referenceBlockCoordinates = that._blockView
                .append("g")
                .attr("id", "reference-block-coordinates")
                .attr("transform", "translate(0," + (that._referenceOffsetY - 4) +")");

            //create block space
            that._tracks = that._blockView
                .append("g")
                .attr("id", "tracks")
                .attr("transform", "translate(0, " + that._referenceOffsetY + ")");

            // create comparison block coordinates space
            that._comparisonBlockCoordinates = that._blockView
                .append("g")
                .attr("id", "comparison-block-coordinates")
                .attr("transform", "translate(0, " + (that._comparisonOffsetY + that._trackHeight + 12) +")");

            // create comparison coordinates space
            that._comparisonCoordinates = this._blockView
                .append("g")
                .attr("id", "comparison-coordinates")
                .attr("transform", "translate(1, " + (that._comparisonOffsetY + that._trackHeight + 27) +")");
        };

        /**
         * stores data passed from DataManager and generates scaling method
         *
         * @param {Object} params - data passed from DataManager
         */
        BlockViewBrowser.prototype.loadData = function (params) {
            let that = this;

            that.getSpecies();
            that._colors = {};

            JaxSynteny.colors.forEach(function(e) {
               that._colors[e.chr] = e.color;
            });

            that._referenceInterval = params.referenceInterval;
            that._resetToOrigInterval = Object.assign({}, params.referenceInterval);
            that._syntenicBlocks = params.syntenicBlocks;
            that._referenceToComparison = params.referenceToComparison;
            that._referenceGenes = params.referenceData;
            that._comparisonGenes = params.comparisonData;
            that._homologIds = params.homologToGenes;
            that._genesToHomologs = params.genesToHomologs;

            that._refGenomeMap = {};
            params.referenceChrSizes.forEach(function(x) {
                that._refGenomeMap[x.chr] = x;
            });

            that._scaleBasesToPixels = d3.scale.linear()
                .domain([0, that._refGenomeMap[that._referenceInterval.chr].size])
                .range([0, that._width]);

            that._referenceScale = d3.scale.linear()
                .range([0, that._width]);
        };

        /**
         * clears the entire svg canvas - removes all elements
         */
        BlockViewBrowser.prototype.cleanUp = function () {
            let that = this;

            that.setmatchedFilterFeatures([]);

            that._blockView.selectAll("*").remove();
            if(that._referenceFeatureGeneIndicators) {
                that._referenceFeatureGeneIndicators.selectAll("*").remove();
            }
            // that._speciesLabels.selectAll("*").remove();

            // every time the block view is rendered, remove all existing tooltips
            // otherwise, they'll stack up
            d3.select("body").selectAll(".block-view").remove();

            //make the path commands an empty list so they don't continually add anchors
            that._anchorPathCommands = [];
            that._highlightedGenes = [];
            that._highlightedQTLs = [];

            JaxSynteny.logger.changeAllStatus("no data loaded", "rgb(153,153,153)");

            if(that._colorlegend) { that._colorlegend.cleanUp(); }
        };

        ////////////////////////////////////////////////////////////////////////
        // Core Functions
        ////////////////////////////////////////////////////////////////////////
        /**
         * invokes the methods responsible for rendering all block view browser elements
         * using data that has been pre-processed and passed from the DataManager class
         *
         * @param {Object} params - data passed from DataManager instance
         */
        BlockViewBrowser.prototype.render = function(params) {
            let that = this;

            if(typeof params === "undefined") {
                that.setBlockViewStatus("missing data", "error");
                throw new Error("The parameters required to render the block view are missing");
            }
            that.loadData(params);

            JaxSynteny.logger.logThis("rendering block view browser");
            that.setBlockViewStatus("rendering", null);

            // clean up before rendering to ensure a blank canvas
            that.cleanUp();

            // chromosome navigation controls buttons
            blockViewNavigation(that);

            that.drawGroupElements();

            that.drawReferenceOverview();

            that.drawCoordinates();

            that.drawTracks(params);

            that.drawColorLegend();

            that.drawSpeciesLabels();

            // do this here to keep linear computation
            let height = $("#block-view-svg").height() + $("#color-key").height() + 80;
            $("#block-view-panel-body").height(height);

            that.changeInterval("4");
        };

        /**
         * takes in new data and implements the changes accordingly
         *
         */
        BlockViewBrowser.prototype.changeInterval = function() {
            let that = this;
            JaxSynteny.logger.logThis("updating view");
            that.setBlockViewStatus("updating view", null);
            if(that._referenceInterval) {
                that.setBlockSelector();
                setTimeout(that.calculateCoordinateValues(), 100);

                // clear marks on view change
                that._referenceBlockCoordinates.selectAll("*").remove();
                that._comparisonBlockCoordinates.selectAll("*").remove();

                // close the persistent tooltip if it's open
                that._geneClickTip.hide();

                that.calculateTransformationData();

                // render and position transparent indicator
                that.positionViewSelectionOverlay();
                that.positionBrush();

                // stretch background to cover the entire track
                that._trackBackground
                    .attr("width", function() {
                        return that.calculateNewWidth({start_pos: 0, end_pos: that.calculateMaxBase()})
                    });

                let visibleRef = that.updateReferenceTrack();
                let visibleComp = that.updateComparisonTrack();

                // remove all existing exons (if any)
                that._tracks.selectAll(".exon").remove();

                // check if we need to draw/redraw exons of visible genes
                if(that._referenceInterval.size < (5 * Math.pow(10, 6))) {
                    that.renderExons(visibleRef, visibleComp);
                }

                that.updateOrientationIndicators();
                that.updateAnchors();

                that.drawBlockCoordinates();
                that.updateBlockCoordinates();

                that.updateScaling();

                $("#ref-genome-interval").val("Chr" + that._referenceInterval.chr + ":"
                    + Math.round(that._referenceInterval.startPos) + "-" + Math.round(that._referenceInterval.endPos));
            }

            that.setBlockViewStatus("done", null);
            $("#spinner").hide();
        };

        /**
         * intended for use from app-controls.js to update all of the elements related to syntenic block orientation
         */
        BlockViewBrowser.prototype.changeOrientation = function() {
            let that = this;

            that._anchorPathCommands = [];
            that._tracks.select("#anchors").remove();
            that.generateReferenceBlockData();
            that.generateFeatureIndicatorPanel();
            that._comparisonGeneData.selectAll(".exon").remove();
            let visibleComp = that.updateComparisonTrack();

            // check if we need to draw/redraw exons of visible genes
            if(that._referenceInterval.size < (5 * Math.pow(10, 6))) {
                that.renderExons(null, visibleComp);
            }

            that.drawOrientationIndicators();
            that.updateOrientationIndicators();
            that.drawAnchors();
            that.updateAnchors();
            that._comparisonBlockCoordinates.selectAll("text").remove();
            that.drawBlockCoordinates();
            that.updateBlockCoordinates();
            that.calculateCoordinateValues();
        };

        ////////////////////////////////////////////////////////////////////////
        // Reference Overview Functions
        ////////////////////////////////////////////////////////////////////////
        /**
         * draws the axis for the reference overview
         */
        BlockViewBrowser.prototype.drawReferenceOverviewAxis = function() {
            let that = this;

            let overviewAxis = that._referenceOverview
                .append("g")
                .attr("class", "axis")
                .attr("transform", "translate(0," + (that._refOverviewHeight + 5)  + ")");

            // generate tick values based on the selected chromosome's length
            // at appropriate intervals (list tends to be 9-11 elements long)
            let ticks = this.generateTickValues();

            // renders X (reference chromosome) scroll axis
            let axis = d3.svg.axis()
                .scale(that._scaleBasesToPixels)
                .orient("bottom")
                .tickValues(ticks)
                .tickFormat(function(d) {
                    // if it's the max, mark the end point as approximately XX Mb
                    if((d/Math.pow(10, 6)) % 1 !== 0) {
                        return "\u2248" + (Math.round(d / Math.pow(10, 6))) + " Mb";
                    }
                    return (d/1000000).toString() + " Mb";
                });

            // makes the first tick mark text aligned to the right of the tick
            overviewAxis.call(axis)
                .select("text")
                .attr("x", 0)
                .style("text-anchor", "start");

            // makes the last tick mark text aligned to the left of the tick
            overviewAxis.selectAll("text").each(function(i) {
                if (i === (ticks[ticks.length - 1])) {
                    this.style.textAnchor = "end";
                }
            });

            // shift last tick mark in so it doesn't disappear
            overviewAxis.selectAll("line").each(function(i) {
                if (i === (ticks[ticks.length - 1])) {
                    this.x2.baseVal.value = -0.5;
                    this.x1.baseVal.value = -0.5;
                }
            });

            // moves the first tick mark to the right by 0.5 unit, so that it lines up with the start of the axis
            overviewAxis.select("g").attr("transform", "translate(0.5, 0)");
        };

        /**
         * draws the syntenic blocks in the reference overview
         */
        BlockViewBrowser.prototype.drawReferenceOverviewBlocks = function() {
            let that = this;

            that._overviewBlocks = that._referenceOverview
                .append("g")
                .attr("id", "overview-blocks");

            // background makes it possible to also interact with the white space in between blocks
            that._overviewBackground = that._overviewBlocks
                .append("rect")
                .attr("id", "overview-background")
                .attr("y", 15)
                .attr("width", that._scaleBasesToPixels(that.calculateMaxBase()))
                .attr("height", that._refOverviewHeight - 30)
                .attr("fill", "#FFF");

            // render syntenic blocks sequence located above chromosome axis
            that._syntenicBlocks.forEach(function(currBlock) {
                // since the reference overview doesn't need orientation info, just pull from matched anchor points
                let refAnchors = currBlock.matchAnchorPoints.refAnchorPoints.anchorPoints;
                let firstRefAnchor = refAnchors[0];
                let lastRefAnchor = refAnchors[refAnchors.length - 1];
                let currChr = currBlock.matchAnchorPoints.compAnchorPoints.chr;
                that._overviewBlocks.append("rect")
                    .attr("x", that._scaleBasesToPixels(firstRefAnchor))
                    .attr("y", 15)
                    .attr("width", that._scaleBasesToPixels(lastRefAnchor + 1) -
                                   that._scaleBasesToPixels(firstRefAnchor))
                    .attr("height", that._refOverviewHeight - 30)
                    .attr("class", "block " + "c" + currChr)
                    .attr("fill", SynUtils.fadeColor(that._colors[currChr], 0.3))
                    .attr("stroke", that._colors[currChr]);
            });
        };

        /**
         * draws the view overlay over the reference overview
         */
        BlockViewBrowser.prototype.drawViewSelectionOverlay = function() {
            let that = this;

            // render transparent scrolling window
			that._viewSelectionOverlay = that._referenceOverview
                .append("rect")
                .attr("id", "view-selection-overlay")
                .attr("y", 10)
                .attr("height", that._refOverviewHeight - 20);

			that.positionViewSelectionOverlay();
        };

        /**
         * updates the position of the overlay
         */
        BlockViewBrowser.prototype.positionViewSelectionOverlay = function() {
            let that = this;

            that._viewSelectionOverlay
                .attr("x", that._scaleBasesToPixels(that._referenceInterval.startPos))
                .attr("width", that._scaleBasesToPixels(that._referenceInterval.size));

        };

        /**
         * binds the zooming and brush functions to the reference overview
         */
        BlockViewBrowser.prototype.bindReferenceOverviewBehaviors = function() {
            let that = this;

            // isZoomable should be false only if the brush action has been
            // triggered; This ensures that zooming is not done while the brush
            // is executing
            let isZoomable = true;

            let brushStart = that._referenceInterval.startPos / that.calculateMaxBase();
            let brushEnd = that._referenceInterval.endPos / that.calculateMaxBase();

            that._brushOverlay = d3.svg.brush()
                .x(that._referenceScale)
                .extent([brushStart, brushEnd])
                .on("brushstart", function() {
                    isZoomable = false;
                    that.positionBrush();
                    d3.select(".extent").style("cursor", "grabbing");

                })
                .on("brush", function() {
                    let extent = d3.select(".extent");

                    extent.style("cursor", "grabbing");

                    let newWidth = that._scaleBasesToPixels.invert(parseInt(extent.attr("width")));
                    let newX = that._scaleBasesToPixels.invert(parseInt(extent.attr("x")));
                    if(newWidth === 0) {
                        newWidth = that._referenceInterval.size;
                        newX = newX - (newWidth / 2);
                    }

                    if(newX < 0) {
                        newX = 0;
                    }

                    that._referenceInterval.startPos = Math.round(newX);
                    that._referenceInterval.size = Math.round(newWidth);
                    that._referenceInterval.endPos = that._referenceInterval.startPos + that._referenceInterval.size;

                    that.changeInterval("1");
                })
                .on("brushend", function() {
                    d3.select(".extent").style("cursor", "grab");
                    isZoomable = true;

                });

            // generate brush element and bind the brush function
            that._brushSelection = that._referenceOverview
                .append("g")
                .attr("class", "brushSelection")
                .call(that._brushOverlay);

            that._brushSelection
                .selectAll("rect")
                .attr("y", 15)
                .attr("height", that._refOverviewHeight - 30);

            d3.select(".extent")
                .style("fill", "none")
                .style("cursor", "grab");

            let currentScale = 1;
            // zooming behavior
            that._zoomOverlay = d3.behavior.zoom()
                .on("zoom", function() {
                    if(isZoomable !== false) {
                        let interval = that._referenceInterval;
                        let minWidth = that._preferences.minWidth;
                        let maxWidth = that.calculateMaxBase();
                        let viewWidth = interval.endPos - interval.startPos;

                        // conditions for zooming out
                        if(that._zoomOverlay.scale() < currentScale) {
                            if (interval.size !== maxWidth) {
                                let newWidth = Math.round(interval.size * that._preferences.zoom.out);
                                let basesToZoom;
                                if (viewWidth <= maxWidth) {
                                    basesToZoom = Math.round((newWidth - viewWidth) / 2);
                                }
                                else {
                                    basesToZoom = Math.round((maxWidth - viewWidth) / 2);
                                }
                                zoomOut(that, basesToZoom);
                            }
                        }
                        // conditions for zooming in
                        else {
                            if (interval.size !== minWidth) {
                                let newWidth = Math.round(interval.size * that._preferences.zoom.in);
                                let basesToZoom;
                                if (newWidth >= minWidth) {
                                    basesToZoom = Math.round((viewWidth - newWidth) / 2);
                                }
                                else {
                                    basesToZoom = Math.round((viewWidth - minWidth) / 2);
                                }
                                zoomIn(that, basesToZoom);
                            }
                        }

                        that._referenceInterval.size = that._referenceInterval.endPos -
                                                       that._referenceInterval.startPos;

                        currentScale = that._zoomOverlay.scale();

                        that.changeInterval("3");
                    }
            });

            // bind zooming behavior to the reference overview, disable scroll zooming
            that._referenceOverview.call(that._zoomOverlay).on("wheel.zoom", null);
        };

        /**
         * updates the brush location and width
         */
        BlockViewBrowser.prototype.positionBrush = function() {
            let that = this;
            let extent = d3.select(".extent");

            extent
                .attr("x", that._scaleBasesToPixels(that._referenceInterval.startPos))
                .attr("width", that._scaleBasesToPixels(that._referenceInterval.size));
        };

        /**
         * draws the reference overview
         */
        BlockViewBrowser.prototype.drawReferenceOverview = function() {
            let that = this;

            that._referenceFeatureGeneIndicators = that._referenceOverview
                .append("g")
                .attr("id", "referenceGeneFeatures")
                .attr("transform", "translate(0, 2)");

            that._comparisonFeatureGeneIndicators = that._referenceOverview
                .append("g")
                .attr("id", "comparisonGeneFeatures")
                .attr("transform", "translate(0, " + (that._refOverviewHeight - 12) + ")");

            that.drawReferenceOverviewAxis();

            that.drawReferenceOverviewBlocks();

            that.drawViewSelectionOverlay();

            that.bindReferenceOverviewBehaviors();

        };

        /**
         * constructs the feature indicator panel
         */
        BlockViewBrowser.prototype.generateFeatureIndicatorPanel = function() {
            let that = this;

            let features = JaxSynteny.highlightedFeatures;
            let filterFeatures = that.getmatchedFilterFeatures();

            let chrFeatures = {
                gene: [],
                qtl: []
            };
            // for each of the interval-related classes gather data for all of the features
            if(features.gene.length > 0) {
                let genes = features.gene;
                genes.forEach(function(e) {
                    if (e.chr === that._referenceInterval.chr) {
                        e.loc = centerCoord(e);
                        chrFeatures.gene.push(e);
                        that._genesToHomologs[e.gene_id].forEach(function(f) {
                            // to avoid duplicates
                            if(!isInHighlightedFeaturesList(that._highlightedGenes, f)) {
                                that._highlightedGenes.push(f);
                            }
                        });
                    }
                });
            }

            if(features.qtl.length > 0) {
                let qtls = features.qtl;
                qtls.forEach(function(e) {
                    if (e.chr === that._referenceInterval.chr) {
                        chrFeatures.qtl.push(e);
                        e.start_pos = parseInt(e.start_pos);
                        e.end_pos = parseInt(e.end_pos);
                        that._highlightedQTLs.push(e);
                    }
                });
                that.arrangeQTLs();
            }

            if(filterFeatures.length > 0 ) {
                chrFeatures.filter = {
                    ref: [],
                    comp: []
                };
                filterFeatures.forEach(function(e) {
                    e.loc = centerCoord(e);
                    if(e.species === "r") {
                        chrFeatures.filter.ref.push(e);
                    } else {
						chrFeatures.filter.comp.push(e);
                    }
                });
            }

            // tooltip displays symbol and interval of highlighted genes/qtls
            that._indicatorTip = d3.tip()
                .attr("class", "d3-tip block-view")
                .attr("id", "indicator-tip")
                .offset([-10, 0])
                .html(function(d) {
                    let varText;
                    if(d.gene_id) {
                        varText = "<b>Gene ID:</b> " + (d.gene_id)
                                + "<br><b>Gene Symbol:</b> " + (d.gene_symbol);
                    }
                    else {
                        varText = "<b>QTL ID:</b> " + (d.qtl_id)
                                + "<br><b>QTL Symbol:</b> " + (d.qtl_symbol);
                    }
                    return varText
                        + "<br><b>Start Position:</b> " + format(d.start_pos)
                        + "<br><b>End Position: </b>" + format(d.end_pos);
            });

            // nested helper function
            function centerCoord(feature) {
                if(feature) {
                    let coord = ((parseFloat(feature.end_pos) - parseFloat(feature.start_pos)) / 2.0) +
                        parseFloat(feature.start_pos);
                    return coord;
                }
                return null;
            }

            // bind the indicator tooltip
            that._referenceFeatureGeneIndicators.call(that._indicatorTip);
            that._comparisonFeatureGeneIndicators.call(that._indicatorTip);

            // draw the lines and the hover rectangles
            that.drawIndicatorLines(chrFeatures);
        };

        /**
         * draws all of the lines and the hover rectangles for the highlighted genes
         *
         * @param {Object} features - object array for all of the highlighted genes
         * @return {string} .id - gene id for the highlighted gene
         * @return {string} .symbol - gene symbol for the highlighted gene
         * @return {number} .loc - location for the feature indicator line
         * @return {number} .start - staring position for the highlighted gene
         * @return {number} .end - ending position for the highlighted gene
         */
        BlockViewBrowser.prototype.drawIndicatorLines = function(features) {
            let that = this;

            that._referenceFeatureGeneIndicators.selectAll("*").remove();
            that._comparisonFeatureGeneIndicators.selectAll("*").remove();

            if(that._referenceFeatureQTLIndicators) {
                that._referenceFeatureQTLIndicators.selectAll("*").remove();
            }

            that.drawFeaturedGeneIndicators(features.gene);


            if(features.filter) {
                that.drawFilteredGeneIndicators(features.filter);
            }

            if(features.qtl.length > 0) {
                that.drawQTLIndicators(features.qtl)
            }
        };

        /**
         * renders highlighted genes above and below the reference overview in red
         *
         * @param {Array} featureGenes - genes to render
         */
        BlockViewBrowser.prototype.drawFeaturedGeneIndicators = function(featureGenes) {
            let that = this;

            that._referenceFeatureGeneHovers = that._referenceFeatureGeneIndicators
                .append("g")
                .attr("id", "ref-hovers");

            // invisible rectangles that will trigger tooltip instead of indicator lines
            that._referenceFeatureGeneHovers.selectAll("rect")
                .data(featureGenes)
                .enter()
                .append("rect")
                .attr("id", function(d) {
                    return d.gene_id + "-hover";
                })
                .attr("transform", function(d) {
                    return "translate(" + (that._scaleBasesToPixels(d.loc) - 2) + ", 0)";
                })
                .attr("width", 5)
                .attr("height", 9)
                .style("stroke", "none")
                .style("fill", "white")
                .on("mouseover", that._indicatorTip.show)
                .on("mousemove", function() { // tooltip follows mouse
                    return that._indicatorTip
                        .style("top", (d3.event.pageY - 10) + "px")
                        .style("left", (d3.event.pageX + 10) + "px");
                })
                .on("mouseout", that._indicatorTip.hide);

            // vertical lines at location of a highlighted feature gene
            that._referenceFeatureGeneIndicators.selectAll("line")
                .data(featureGenes)
                .enter()
                .append("line")
                .attr("class", "indicator")
                .attr("id", function(d) {
                    return d.gene_id + "-indicator";
                })
                .attr("transform", function(d) {
                    return "translate(" + that._scaleBasesToPixels(d.loc) + ", 0)";
                })
                .style("stroke", "red")
                .style("shape-rendering", "crispEdges")
                .attr("y2", 10);

            let comparisonFeatures = [];
                featureGenes.forEach(function(e) {
                    let homologs = that._referenceToComparison[e.gene_id].homologs;
                    if (homologs.length > 0) {
                        homologs.forEach(function(f) {
                            f.loc = ((f.end_pos - f.start_pos) / 2) +
                                f.start_pos;

                            comparisonFeatures.push(f);
                        });
                    }
                });

            that._comparisonFeatureGeneHovers = that._comparisonFeatureGeneIndicators
                .append("g")
                .attr("id", "comp-hovers");

            // invisible rectangles that will trigger tooltip instead of indicator lines
            that._comparisonFeatureGeneHovers.selectAll("rect")
                .data(comparisonFeatures)
                .enter()
                .append("rect")
                .attr("id", function(d) {
                    return d.gene_id + "-hover";
                })
                .attr("transform", function(d) {
                    let x = that._scaleCompToRefBases[that._anchorPoints][d.block_id](parseInt(d.loc)) - 2;
                    return "translate(" + x + ", 0)";
                })
                .attr("width", 5)
                .attr("height", 9)
                .style("stroke", "none")
                .style("fill", "white")
                .on("mouseover", that._indicatorTip.show)
                .on("mousemove", function() { // tooltip follows mouse
                    return that._indicatorTip
                        .style("top", (d3.event.pageY - 10) + "px")
                        .style("left", (d3.event.pageX + 10) + "px");
                })
                .on("mouseout", that._indicatorTip.hide);

            // vertical lines at location of a highlighted feature gene
            that._comparisonFeatureGeneIndicators.selectAll("line")
                .data(comparisonFeatures)
                .enter()
                .append("line")
                .attr("class", "indicator")
                .attr("id", function(d) {
                    return d.gene_id + "-indicator";
                })
                .attr("transform", function(d) {
                    let x = that._scaleCompToRefBases[that._anchorPoints][d.block_id](parseInt(d.loc));
                    return "translate(" + x + ", 0)";
                })
                .style("stroke", "red")
                .style("shape-rendering", "crispEdges")
                .attr("y2", 10);
        };

        /**
         * renders filtered genes above and below the reference overview from the filters
         *
         * @param {Object} filterGenes - genes to render
         * @param {Array} filterGenes.ref - genes to render above the reference overview
         * @param {Array} filterGenes.comp - genes to render below the reference overview
         */
        BlockViewBrowser.prototype.drawFilteredGeneIndicators = function(filterGenes) {
            let that = this;

            that._referenceFilterGeneHovers = that._referenceFeatureGeneIndicators
                    .append("g")
                    .attr("id", "ref-filter-hovers");

                that._referenceFilterGeneIndicators = that._referenceFeatureGeneIndicators
                    .append("g")
                    .attr("id", "ref-filter-indicators");

                // invisible rectangles that will trigger tooltip instead of indicator lines
                that._referenceFilterGeneHovers.selectAll("rect")
                    .data(filterGenes.ref)
                    .enter()
                    .append("rect")
                    .attr("id", function(d) {
                        return d.gene_id + "-hover";
                    })
                    .attr("transform", function(d) {
                        return "translate(" + (that._scaleBasesToPixels(d.loc) - 2) + ", 0)";
                    })
                    .attr("width", 5)
                    .attr("height", 9)
                    .style("stroke", "none")
                    .style("fill", "white")
                    .on("mouseover", that._indicatorTip.show)
                    .on("mousemove", function() { // tooltip follows mouse
                        return that._indicatorTip
                            .style("top", (d3.event.pageY - 10) + "px")
                            .style("left", (d3.event.pageX + 10) + "px");
                    })
                    .on("mouseout", that._indicatorTip.hide);

                that._referenceFilterGeneIndicators.selectAll("line")
                    .data(filterGenes.ref)
                    .enter()
                    .append("line")
                    .attr("class", "indicator")
                    .attr("id", function(d) {
                        return d.gene_id + "-indicator";
                    })
                    .attr("transform", function(d) {
                        return "translate(" + that._scaleBasesToPixels(d.loc) + ", 0)";
                    })
                    .style("stroke", "blue")
                    .style("shape-rendering", "crispEdges")
                    .attr("y2", 10);


                that._comparisonFilterGeneHovers = that._comparisonFeatureGeneIndicators
                    .append("g")
                    .attr("id", "comp-filter-hovers");

                that._comparisonFilterGeneIndicators = that._comparisonFeatureGeneIndicators
                    .append("g")
                    .attr("id", "comp-filter-indicators");

                // invisible rectangles that will trigger tooltip instead of indicator lines
                that._comparisonFilterGeneHovers.selectAll("rect")
                    .data(filterGenes.comp)
                    .enter()
                    .append("rect")
                    .attr("id", function(d) {
                        return d.gene_id + "-hover";
                    })
                    .attr("transform", function(d) {
                        let x = that._scaleCompToRefBases[that._anchorPoints][d.block_id](parseInt(d.loc)) - 5;
                        return "translate(" + x + ", 0)";
                    })
                    .attr("width", 11)
                    .attr("height", 9)
                    .style("stroke", "none")
                    .style("fill", "white")
                    .on("mouseover", that._indicatorTip.show)
                    .on("mousemove", function() { // tooltip follows mouse
                        return that._indicatorTip
                            .style("top", (d3.event.pageY - 10) + "px")
                            .style("left", (d3.event.pageX + 10) + "px");
                    })
                    .on("mouseout", that._indicatorTip.hide);

                that._comparisonFilterGeneIndicators.selectAll("line")
                    .data(filterGenes.comp)
                    .enter()
                    .append("line")
                    .attr("class", "indicator")
                    .attr("id", function(d) {
                        return d.gene_id + "-indicator";
                    })
                    .attr("transform", function(d) {
                        let x = that._scaleCompToRefBases[that._anchorPoints][d.block_id](parseInt(d.loc));
                        return "translate(" + x + ", 0)";
                    })
                    .style("stroke", "blue")
                    .style("shape-rendering", "crispEdges")
                    .attr("y2", 10);
        };

        /**
         * renders highlighted QTLs above the reference overview from the feature search
         *
         * @param {Array} QTLs - QTLs to render
         */
        BlockViewBrowser.prototype.drawQTLIndicators = function(QTLs) {
            let that = this;

            that._referenceFeatureQTLIndicators = that._referenceOverview
                    .append("g")
                    .attr("id", "referenceQTLFeatures")
                    .attr("transform", "translate(0, 2)");

                that._referenceFeatureQTLHovers = that._referenceFeatureQTLIndicators
                    .append("g")
                    .attr("id", "ref-hovers");

                // red rectangles representing QTLs and will also have tooltip bound
                that._referenceFeatureQTLHovers.selectAll("rect")
                    .data(QTLs)
                    .enter()
                    .append("rect")
                    .attr("id", function(d) { return d.qtl_id + "-hover"; })
                    .attr("transform", function(d) {
                        let x = that._scaleBasesToPixels(d.start_pos);
                        let y = 0;

                        if(that._QTLArrangeData) {
                            let laneHeight = 9 / that._QTLArrangeData[d.qtl_id].numLanes;
                            y = (laneHeight * that._QTLArrangeData[d.qtl_id].lane);
                        }

                        return "translate(" + x + ", " + y + ")";
                    })
                    .attr("width", function(d) {
                        let size = d.end_pos - d.start_pos;
                        let width = that._scaleBasesToPixels(size);
                        if(width >= 1) {
                            return width;
                        }
                        return 2;
                    })
                    .attr("height", 1)
                    .style("fill", "#421C52")
                    .style("shape-rendering", "crispEdges")
                    .on("mouseover", that._indicatorTip.show)
                    .on("mousemove", function() { // tooltip follows mouse
                        return that._indicatorTip
                            .style("top", (d3.event.pageY - 10) + "px")
                            .style("left", (d3.event.pageX + 10) + "px");
                    })
                    .on("mouseout", that._indicatorTip.hide);
        };

        /**
         * generates appropriate number of ticks based on the best interval
         *
         * @return {Array} values - list of tick locations for axis
         */
        BlockViewBrowser.prototype.generateTickValues = function () {
            let that = this;
            let values = [];
            let tickInterval = that.calculateTickInterval();
            //padding will give the end of the axis more room so it isn't overlapped
            //by another label
            let padding = Math.round(that.calculateMaxBase() / 15);

            let count = 0;
            //add tick mark values to list
            while (count < (that.calculateMaxBase()) - padding) {
                values.push(count);
                count += tickInterval;
            }

            //Eliminates second tick at almost the very end (source of problem is
            //chr3)
            let roundedValue = Math.pow(10, 5) * Math.round(that.calculateMaxBase() / Math.pow(10, 5));
            if (values[values.length - 1] !== roundedValue) {
                values.push(that.calculateMaxBase());
            }

            return values;
        };

        ////////////////////////////////////////////////////////////////////////
        // Coordinate Functions
        ////////////////////////////////////////////////////////////////////////
        /**
         * creates a coordinate
         *
         * @param {number} translateX - x value for the coordinate
         * @param {string} type - "start" or "end" to determine which side of view
         * @param {string} which - "ref" or "comp" to determine which track
         * @param {Object} parent - the parent coordinate group that should contain the coordinate
         */
        BlockViewBrowser.prototype.makeCoordinate = function(translateX, type, which, parent) {
            let id = which + "-coord-" + type;
            let textPadding = translateX - 3;
            let textOffsetY = 0;

            if (type === "start") {
                textPadding = translateX + 3;
            }
            if (which === "ref") {
                textOffsetY = -15
            }

            parent
                .append("line")
                .attr("transform", "translate(" + translateX + ", 0)")
                .attr("shape-rendering", "crispEdges")
                .attr("y2", -25)
                .attr("stroke", "black")
                .attr("x2", 0);

            parent
                .append("text")
                .attr("id", id)
                .attr("text-anchor", type)
                .attr("transform", "translate(" + textPadding + ", " + textOffsetY + ")");

        };

        /**
         * draws the four coordinates for the tracks and create coordinate object
         */
        BlockViewBrowser.prototype.drawCoordinates = function() {
            let that = this;

            // starting coordinate for reference
            that.makeCoordinate(0, "start", "ref", that._referenceCoordinates);

            // ending endpoint coordinate for reference
            that.makeCoordinate(that._width-1, "end", "ref", that._referenceCoordinates);

            // starting coordinate for comparison
            that.makeCoordinate(0, "start", "comp", that._comparisonCoordinates);

            // ending endpoint coordinate for comparison
            that.makeCoordinate(that._width-1, "end", "comp", that._comparisonCoordinates);

            that._refCoordinates = [
                d3.select("#ref-coord-start"),
                d3.select("#ref-coord-end")
            ];
            that._compCoordinates = [
                d3.select("#comp-coord-start"),
                d3.select("#comp-coord-end")
            ];
        };

        ////////////////////////////////////////////////////////////////////////
        // Track-Related Functions
        ////////////////////////////////////////////////////////////////////////
        // Drawing/Initialization   ////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////
        /**
         * generates the block data needed to draw the blocks for the tracks
         *
         * @return {Object} - object array of syntenic blocks
         */
        BlockViewBrowser.prototype.generateReferenceBlockData = function() {
            let that = this;
            let blocks = [];
            let locsForIndicators = [];

            let endpoints = [];

            // create an object that we can use to lookup data on with the block id for lookup
            that.syntenicBlockLookup = {};

            that._syntenicBlocks.forEach(function(currBlock) {
                let anchorPoints = currBlock[that._anchorPoints].refAnchorPoints.anchorPoints;
                let firstRefAnchor = anchorPoints[0];
                let lastRefAnchor = anchorPoints[anchorPoints.length - 1];

                let blockInfo = {
                    start_pos: firstRefAnchor,
                    end_pos: lastRefAnchor,
                    comp_start: currBlock[that._anchorPoints].compAnchorPoints.anchorPoints[0],
                    comp_end: currBlock[that._anchorPoints].compAnchorPoints.anchorPoints[anchorPoints.length-1],
                    chr: currBlock.matchAnchorPoints.compAnchorPoints.chr, // just use matched anchor points for chr
                    orientation_match: currBlock.orientationMatch
                };

                blocks.push(blockInfo);

                if(that._anchorPoints !== "trueAnchorPoints") {
                    if (!currBlock.orientationMatch) {
                        let firstLine = {
                            start_pos: firstRefAnchor,
                            end_pos: lastRefAnchor
                        };

                        let secondLine = {
                            start_pos: lastRefAnchor,
                            end_pos: firstRefAnchor
                        };

                        locsForIndicators.push(firstLine, secondLine);
                    }
                }

                // add the scaling factor to the lookup info
                let refSize = lastRefAnchor - firstRefAnchor;
                let compSize = blockInfo.comp_end - blockInfo.comp_start;
                blockInfo.scale_to_comp = compSize / refSize;

                that.syntenicBlockLookup[currBlock.symbol] = blockInfo;

                // generate a list of all syntenic endpoints (start position and end position), in descending order by
                // location. This list is to be used for track coordinates (not block coordinates) purposes.
                endpoints.push({
                    loc: firstRefAnchor,
                    lessThan: null,
                    greaterThan: currBlock.symbol
                });
                endpoints.push({
                    loc: lastRefAnchor,
                    lessThan: currBlock.symbol,
                    greaterThan: null
                });
            });

            // make sure the descending endpoints are sorted and then reverse them
            endpoints.sort(function(a, b) {
                if(a.loc < b.loc) { return 1; }
                return -1;
            });

            // make an ascending list of endpoints
            let ascEndpoints = endpoints.slice(0).reverse();

            that.syntenicBlockEndpoints = {
                desc: endpoints,
                asc: ascEndpoints
            };

            return {forBlocks: blocks, forIndicators: locsForIndicators};
        };

        /**
         * draws the groups for each of the tracks
         */
        BlockViewBrowser.prototype.drawTrackGroups = function() {
            let that = this;

            // background makes it possible to also interact with the white space in between blocks
            that._trackBackground = that._tracks
                .append("rect")
                .attr("id", "track-background")
                .attr("width", that._scaleBasesToPixels(that.calculateMaxBase()))
                .attr("height", (that._comparisonOffsetY+that._trackHeight))
                .attr("fill", "#FFF");

            that._reference = that._tracks
                .append("g")
                .attr("id", "reference");

            that._comparison = that._tracks
                .append("g")
                .attr("id", "comparison")
                .attr("transform", "translate(0, " + (that._trackHeight + (that._height * 0.05)) + ")");
        };

        /**
         * generate and bind the zooming behaviors for the tracks
         */
        BlockViewBrowser.prototype.bindTrackBehaviors = function() {
            let that = this;

            let isZoomable = true;

            let maxScale = that.calculateMaxBase() / that._preferences.minWidth;

            that._zoomTracks = d3.behavior.zoom()
                .scaleExtent([1, maxScale])
                .on("zoomstart", function() { isZoomable = false; })
                .on("zoom", () => {
                    let tempStart = that._scaleBasesToPixels.invert(
                        (0 - that._zoomTracks.translate()[0]) / that._zoomTracks.scale()
                    );
                    let tempEnd = that._scaleBasesToPixels.invert(
                        (that._width - that._zoomTracks.translate()[0]) / that._zoomTracks.scale()
                    );
                    let tempSize = tempEnd - tempStart;

                    // handles end cases to keep from scrolling/zooming too far
                    if (tempStart >= 0 && tempEnd <= that.calculateMaxBase()) {
                        that._referenceInterval.startPos = tempStart;
                        that._referenceInterval.endPos = tempStart + tempSize;
                    }
                    else if (tempStart < 0 && tempEnd <= that.calculateMaxBase()) {
                        that._referenceInterval.startPos = 0;
                        that._referenceInterval.endPos = tempSize;
                    }
                    else if (tempStart >= 0 && tempEnd > that.calculateMaxBase()) {
                        that._referenceInterval.endPos = that.calculateMaxBase();
                        that._referenceInterval.startPos = that.calculateMaxBase() - tempSize;
                    }

                    that._referenceInterval.size = that._referenceInterval.endPos -
                                                   that._referenceInterval.startPos;

                    that.changeInterval("2");
                })
                .on("zoomend", function() { isZoomable = true; });

            // reference group zoom binding, disable scroll zooming
            that._tracks.call(that._zoomTracks).on("wheel.zoom", null);

        };

        /**
         * makes the tooltips for the genes and the syntenic blocks
         */
        BlockViewBrowser.prototype.generateTooltips = function() {
            let that = this;

            that._geneTip = d3.tip()
                .attr("class", "d3-tip block-view")
                .attr("id", "gene-tip")
                .offset([-10, 0])
                .html(function(d) {
                    return "<b>Gene ID:</b> " + d.gene_id
                         + "<br><b>Gene Symbol:</b> " + d.gene_symbol
                         + "<br><b>Start Position:</b> " + format(d.start_pos)
                         + "<br><b>End Position: </b>" + format(d.end_pos)
                         + "<br><b>Homologs: </b>" + getNumHomologs(that, d)
                         + "<br><b>Strand: </b>" + d.gene.strand;
                });

            that._tracks.call(that._geneTip);

            that._geneClickTip = d3.tip()
                .attr("class", "d3-tip block-view")
                .attr("id", "gene-click-tip")
                .offset([-10, 0])
                .html(function(d) {
                    let extLinks = "";

                    let thisSpecies = d.taxon_id;

                    let species;
                    (thisSpecies === referenceSpecies.id) ?
                        species = JaxSynteny.speciesRef :
                        species = JaxSynteny.speciesComp;

                    let resources = species.externalResources;
                    // check if there are any external resources that can be linked
                    if (resources.length !== 0) {
                        extLinks += "<br>";
                        resources.forEach(function(e) {
                            // TODO Do a link check for e.url + d.gene_id
                            extLinks += "<br><b>"
                                     + e.name + ":</b> <a target='_blank' href='"
                                     + e.url + d.gene_id + "'>Link to Resource</a>";
                        })
                    }

                    return "<b>Gene ID:</b> " + d.gene_id
                         + "<br><b>Gene Symbol:</b> " + d.gene_symbol
                         + "<br><b>Start Position:</b> " + format(d.start_pos)
                         + "<br><b>End Position: </b>" + format(d.end_pos)
                         + "<br><b>Homologs: </b>" + getNumHomologs(that, d)
                         + "<br><b>Strand: </b>" + d.gene.strand
                         + extLinks;
                });

            that._tracks.call(that._geneClickTip);

            that._refBlockTip = d3.tip()
                .attr("class", "d3-tip block-view")
                .attr("id", "ref-block-tip")
                .offset([-10, 0])
                .html(function(d) {
                    if(d.qtl_id) {
                        return "<b>QTL ID:</b> " + d.qtl_id
                             + "<br><b>QTL Symbol:</b> " + d.qtl_symbol
                             + "<br><b>Start Position:</b> " + format(d.start_pos) + " b"
                             + "<br><b>End Position: </b>" + format(d.end_pos) + " b";
                    }

                    return "<b>" + referenceSpecies.name + "</b>"
                         + "<br/>Chr: " + that._referenceInterval.chr
                         + "<br/>Start: " + format(d.start_pos) + " b"
                         + "<br/>End: " + format(d.end_pos) + " b";
                });

            that._reference.call(that._refBlockTip);

            that._compBlockTip = d3.tip()
                .attr("class", "d3-tip block-view")
                .attr("id", "comp-block-tip")
                .offset([-10, 0])
                .html(function(d) {
                    let compStart = d.comp_start;
                    let compEnd = d.comp_end;

                    if(that._anchorPoints === "trueAnchorPoints" && !d.orientation_match) {
                        compStart = d.comp_end;
                        compEnd = d.comp_start;
                    }
                    return "<b>" + comparisonSpecies.name + "</b>"
                         + "<br/>Chr: " + d.chr
                         + "<br/>Start: " + format(compStart) + " b"
                         + "<br/>End: " + format(compEnd) + " b";
                });

            that._comparison.call(that._compBlockTip);
        };

        /**
         * draws the reference and comparison tracks
         *
         * @param {Object} params - data sent from data-manager
         * @param {string} params.species - reference species id,
         * @param {Object} params.referenceChrSizes - reference chromosome sizes
         * @param {Object} params.referenceData - data for reference chromosome
         * @param {Object} params.comparisonData - data for comparison chromosome
         * @param {Object} params.syntenicBlocks: - data for syntenic blocks
         * @param {Object} params.referenceInterval - current reference interval
         */
        BlockViewBrowser.prototype.drawTracks = function(params) {
            let that = this;

            let data = that.generateReferenceBlockData();

            that.drawTrackGroups();

            that.drawOrientationIndicators(data.forIndicators);

            that.drawAnchors();

            let features = JaxSynteny.highlightedFeatures;

            // check if there are any highlighted genes to display
			if (features.qtl.length > 0 || features.gene.length > 0) {
                that.generateFeatureIndicatorPanel();
            }

            that.generateTooltips();

            that.drawReferenceTrack(data.forBlocks, params.referenceData);
            that.drawComparisonTrack(data.forBlocks, params.comparisonData);

            that.bindTrackBehaviors();
        };

        /**
         * renders reference track elements; note: because of associated mouse events,
         * rendering the track's elements in certain order is important!
         * syntenic blocks => labels & genes
         * 
         * @param {Object} referenceBlockData - object array of syntenic block data
         * @param {Object} referenceData - contains all data for reference exons and genes
         */
        BlockViewBrowser.prototype.drawReferenceTrack = function(referenceBlockData, referenceData) {
            let that = this;

            that.drawReferenceTrackBlocks(referenceBlockData);

            that._referenceGeneData = that._reference
                .append("g")
                .attr("id", "reference-gene-data");

            // reference gene groups
            let geneGroups = that._referenceGeneData.selectAll("g")
                .data(referenceData)
                .enter()
                .append("g")
                .attr("id", function(d) { return d.gene_id; })
                .attr("class", function(d) { return ("homolog-" + d.homolog_id + " " + d.auto_block_id); })
                .on("mouseover", function(d) {
                    // highlight this feature and its homologs (if any)
                    d3.select(this).selectAll("*")
                        .attr("fill", SynUtils.highlightColor);

                    if(d.homolog_id !== -1) {
                        that._tracks.selectAll(".homolog-" + d.homolog_id).selectAll("*")
                            .attr("fill", SynUtils.highlightColor);
                    }
                    that._geneTip.show(d);
                })
                .on("click", function(d) {
                    that._geneTip.hide();
                    toggleToolTip(that, d);
                })
                .on("mousemove", function() {
                    // tooltip follows mouse
                    return that._geneTip
                        .style("top",(d3.event.pageY-10)+"px")
                        .style("left",(d3.event.pageX+10)+"px");
                })
                .on("mouseout", function(d) {
                    // only toggle color back to black if the gene isn't a highlighted feature
                    let color = "black";
                    d3.select(this).attr("fill", function(d) {
                        color = getFeatureColor(that, d.homolog_id);
                        return color;
                    });

                    if(d.homolog_id !== -1) {
                        that._tracks.selectAll(".homolog-" + d.homolog_id).selectAll("*")
                            .attr("fill", color);
                    }

                    that._geneTip.hide(d);
                });

            // reference symbols
            geneGroups.append("text")
                .attr("dy", "-1.0")
                .attr("class", "label")
                .attr("fill", function(d) {
                    return getFeatureColor(that, d.homolog_id);
                })
                .text(function(d) { return d.gene_symbol; });

            // reference genes
            geneGroups.append("rect")
                .attr("class", "gene")
                .attr("height", SynUtils.geneHeight)
                .attr("fill", function(d) {
                    return getFeatureColor(that, d.homolog_id);
                })
                .attr("opacity", 0.4);
        };

        /**
         * draws (with x and width values) exons to their associated gene group; visibleRef will be null if this function
         * is called from the changeOrientation method as the comparison track is the only track that needs to be removed
         *
         * @param {Object} visibleRef || null - array of d3 references to the visible reference gene groups
         * @param {Object} visibleComp - array of d3 references to the visible comparison gene groups
         */
        BlockViewBrowser.prototype.renderExons = function(visibleRef = null, visibleComp) {
            let that = this;

            // visibleRef may be null if we're just changing the orientation of comparison blocks
            if(visibleRef) {
                visibleRef.each(function(d) {
                    d3.select(this)
                        .selectAll(".exon")
                        .data(d.exons)
                        .enter()
                        .append("rect")
                        .attr("class", "exon")
                        .attr("y", 0.5)
                        .attr("height", SynUtils.geneHeight - 1)
                        .attr("fill", getFeatureColor(that, d.homolog_id))
                        .attr("width", function(e) {
                            let ratio = that.calculateNewWidth(d) /
                                        that._scaleBasesToPixels(d.end_pos - d.start_pos);
                            let exonWidth = that._scaleBasesToPixels(e.end_pos - e.start_pos);

                            return exonWidth * ratio;
                        })
                        .attr("x", function(e) {
                            let ratio = that.calculateNewWidth(d) /
                                        that._scaleBasesToPixels(d.end_pos - d.start_pos);
                            let start = that._scaleBasesToPixels(e.start_pos - d.start_pos);

                            return start * ratio;
                        });
                });
            }

            visibleComp.each(function(d) {
                d3.select(this)
                    .selectAll(".exon")
                    .data(d.exons)
                    .enter()
                    .append("rect")
                    .attr("class", "exon")
                    .attr("y", 0.5)
                    .attr("height", SynUtils.geneHeight - 1)
                    .attr("fill", function() {
                        // all comparison gene elements need to iterate through array of HOMOLOG_IDS not homolog_id
                        let color = "black";
                        d.homolog_ids.forEach(function(e) {
                            if(color === "black") { color = getFeatureColor(that, e); }
                        });
                        return color;
                    })
                    .attr("width", function(e) {
                        let ratio = that.calculateNewScaledWidth(d) / (d.end_pos - d.start_pos);
                        let exonWidth = e.end_pos - e.start_pos;
                        return Math.abs(exonWidth * ratio);
                    })
                    .attr("x", function(e) {
                        let ratio = that.calculateNewScaledWidth(d) / (d.end_pos - d.start_pos);
                        let start;
                        if(that._anchorPoints === "matchAnchorPoints") {
                            if (!d.strand_match) {
                                start = d.end_pos - e.end_pos;
                            }
                            else {
                                start = e.start_pos - d.start_pos;
                            }
                        } else {
                            start = e.start_pos - d.start_pos;
                        }
                        return Math.abs(start * ratio);
                    });
            });
        };

        /**
         * renders syntenic blocks for reference track
         *
         * @param {Object} referenceBlockData - object array of syntenic block data
         */
        BlockViewBrowser.prototype.drawReferenceTrackBlocks = function(referenceBlockData) {
            let that = this;

            that._referenceBlocksGrp = that._reference
                .append("g")
                .attr("id", "reference-blocks");

            // draw syntenic blocks
            that._referenceBlocksGrp.selectAll("rect")
                .data(referenceBlockData)
                .enter()
                .append("rect")
                .attr("height", that._trackHeight)
                .attr("class", "reference");

            if(that._highlightedQTLs.length > 0) {
                that.drawReferenceQTLs();
            }

        };

        /**
         * renders QTLs in a way such that the ranges won't overlap
         */
        BlockViewBrowser.prototype.drawReferenceQTLs = function() {
            let that = this;

            that._referenceBlocksGrp.selectAll(".qtl").remove();
            
            that._referenceBlocksGrp.selectAll(".qtl")
                .data(that._highlightedQTLs)
                .enter()
                .append("rect")
                .attr("height", function(d) {
                    if(that._QTLArrangeData) {
                        return that._trackHeight / that._QTLArrangeData[d.qtl_id].numLanes;
                    }
                    return that._trackHeight;
                })
                .attr("y", function(d) {
                    if(that._QTLArrangeData) {
                        let laneHeight = that._trackHeight / that._QTLArrangeData[d.qtl_id].numLanes;
                        return (laneHeight * that._QTLArrangeData[d.qtl_id].lane);
                    }
                    return 0;
                })
                .attr("fill", SynUtils.fadeColor("#421C52", 0.2))
                .attr("stroke", "#421C52")
                .attr("class", "qtl")
                .attr("id", function(d) {
                    return d.qtl_id
                });
        };

        /**
         * draws crossed red lines between reference and comparison blocks that don't match in orientation
         */
        BlockViewBrowser.prototype.drawOrientationIndicators = function(locationData) {
            let that = this;

            // if the indicator group already exists and this method is being called, it's probably due to
            // orientation change. Hide the indicators for now and determine if we show them later
            if(that._orientationIndicators) {
                that._orientationIndicators.selectAll("*").attr("display", "none");
            }

            // only do this the orientation shown isn't true
            if(that._anchorPoints !== "trueAnchorPoints") {
                // if we haven't made the indicator group, make it now
                if(!that._orientationIndicators) {
                    that._orientationIndicators = that._tracks
                        .append("g")
                        .attr("id", "orientation-indicators");

                    that._orientationIndicators.selectAll("line")
                        .data(locationData)
                        .enter()
                        .append("line")
                        .attr("y1", that._trackHeight)
                        .attr("y2", that._trackHeight + (that._height * 0.05))
                        .style("stroke", SynUtils.fadeColor("#f00", 0.5));
                } else { // otherwise we should be showing the indicators
                    that._orientationIndicators.selectAll("*").attr("display", "initial");
                }
            }
        };

        /**
         * updates the x1 and x2 values for the crossed red lines that indicate mismatched orientation
         */
        BlockViewBrowser.prototype.updateOrientationIndicators = function() {
            let that = this;

            // only do this the orientation shown isn't true
            if(that._anchorPoints !== "trueAnchorPoints") {
                that._orientationIndicators.selectAll("line")
                    .attr("x1", function (d) { return that.calculateNewX(d); })
                    .attr("x2", function (d) { return that.calculateNewX(d) + that.calculateNewWidth(d); });
            }
        };

        /**
         * renders comparison track elements; note: because of associated mouse events,
         * rendering the track's elements in certain order is important!
         * syntenic blocks => labels & genes
         *
         * @param {Object} referenceBlockData - object array of syntenic blocks
         * @param {Object} comparisonData - contains all data for comparison exons and genes
         */
        BlockViewBrowser.prototype.drawComparisonTrack = function(referenceBlockData, comparisonData) {
            let that = this;

            that.drawComparisonTrackBlocks(referenceBlockData);

            that._comparisonGeneData = that._comparison
                .append("g")
                .attr("id", "comparison-gene-data");

            // comparison gene groups
            let geneGroups = that._comparisonGeneData.selectAll("g")
                .data(comparisonData)
                .enter()
                .append("g")
                .attr("id", function(d) { return d.gene_id; })
                .attr("class", function(d) {
                    let homologs = "homolog-" + d.homolog_ids[0];
                    // all comparison gene elements need to iterate through array of HOMOLOG_IDS not homolog_id
                    d.homolog_ids.forEach(function(e, i) {
                        if(i !== 0) {
                            homologs += (" homolog-" + e);
                        }
                    });
                    return homologs + " " + d.auto_block_id;
                })
                .on("mouseover", function(d) {
                    d3.select(this).selectAll("*")
                        .attr("fill", SynUtils.highlightColor);

                    d.homolog_ids.forEach(function(e) {
                        that._reference.selectAll(".homolog-" + e).selectAll("*")
                        .attr("fill", SynUtils.highlightColor);
                    });
                    that._geneTip.show(d);
				})
                .on("click", function(d) {
                    that._geneTip.hide();
                    toggleToolTip(that, d);
                })
                .on("mousemove", function() { // tooltip follows mouse
                    return that._geneTip
                        .style("top",(d3.event.pageY-10)+"px")
                        .style("left",(d3.event.pageX+10)+"px");
                })
                .on("mouseout", function(d) {
                    // all comparison gene elements need to iterate through array of HOMOLOG_IDS not homolog_id
                    let color = "black";
                    d3.select(this).selectAll("*").attr("fill", function() {
                        d.homolog_ids.forEach(function(e) {
                            if(color === "black") {
                                color = getFeatureColor(that, e);
                            }
                        });
                        return color;
                    });
                    d.homolog_ids.forEach(function(e) {
                        that._reference.selectAll(".homolog-" + e).selectAll("*")
                        .attr("fill", color);
                    });
                    that._geneTip.hide();
				});

            // comparison symbols
            geneGroups.append("text")
                .attr("dy", "-1.0")
                .attr("class", "label")
                .text(function(d) { return d.gene_symbol; });

            // comparison genes
            geneGroups.append("rect")
                .attr("class", "gene")
                .attr("height", SynUtils.geneHeight)
                .attr("opacity", 0.4);

            geneGroups.selectAll("*")
                .attr("fill", function(d) {
                    // all comparison gene elements need to iterate through array of HOMOLOG_IDS not homolog_id
                    let color = "black";
                    d.homolog_ids.forEach(function(e) {
                        if(color === "black") {
                            color = getFeatureColor(that, e);
                        }
                    });
                    return color;
                });
        };

        /**
         * renders syntenic blocks for comparison track
         *
         * @param {Object} referenceBlockData - object array of syntenic block data
         */
        BlockViewBrowser.prototype.drawComparisonTrackBlocks = function(referenceBlockData) {
            let that = this;

            that._comparisonBlocksGrp = that._comparison
                .append("g")
                .attr("id", "comparison-blocks")
                .attr("transform", "translate(0, 0)");

            // we use referenceBlockData to draw the blocks since they will display the same
            // width (and possibly color coding) as their matching blocks on the reference track
            that._comparisonBlocksGrp
                .selectAll("rect")
                .data(referenceBlockData)
                .enter()
                .append("rect")
                .attr("height", that._trackHeight)
                .attr("class", function(d) {
                    return "block c" + d.chr;
                })
                .attr("fill", function(d) {
                    return SynUtils.fadeColor(that._colors[d.chr], 0.3);
                })
                .attr("stroke", function(d) {
                    return that._colors[d.chr];
                });
        };

        /**
         * generates the anchor lines
         */
        BlockViewBrowser.prototype.drawAnchors = function() {
            let that = this;

            // chromosomes area anchors setup
            that._anchorGrp = that._tracks
                .append("g")
                .attr("id", "anchors");

            that._scaleCompToRefBases = {
                trueAnchorPoints: {},
                matchAnchorPoints: {}
            };

            that._syntenicBlocks.forEach(function (currBlock) {
                let referenceAnchorPoints = currBlock[that._anchorPoints].refAnchorPoints.anchorPoints;
                let comparisonAnchorPoints = currBlock[that._anchorPoints].compAnchorPoints.anchorPoints;
                let firstRefAnchorPos = that._scaleBasesToPixels(referenceAnchorPoints[0]);
                let lastIndex = referenceAnchorPoints.length - 1;
                let lastRefAnchorPos = that._scaleBasesToPixels(referenceAnchorPoints[lastIndex]);

                // We need to use the true anchor points to make the scale for matching orientation
                let firstCompAnchor = currBlock.trueAnchorPoints.compAnchorPoints.anchorPoints[0];
                let lastCompAnchor = currBlock.trueAnchorPoints.compAnchorPoints.anchorPoints[lastIndex];

                that._scaleCompToRefBases.trueAnchorPoints[currBlock.symbol] = d3.scale.linear()
                    .domain([firstCompAnchor, lastCompAnchor])
                    .range([firstRefAnchorPos, lastRefAnchorPos]);

                // We need to use the match anchor points to make the scale for true orientation
                firstCompAnchor = currBlock.matchAnchorPoints.compAnchorPoints.anchorPoints[0];
                lastCompAnchor = currBlock.matchAnchorPoints.compAnchorPoints.anchorPoints[lastIndex];

                that._scaleCompToRefBases.matchAnchorPoints[currBlock.symbol] = d3.scale.linear()
                    .domain([firstCompAnchor, lastCompAnchor])
                    .range([firstRefAnchorPos, lastRefAnchorPos]);

                let blockAnchorPathCommands = [];
                for (let i = 0; i < referenceAnchorPoints.length; i++) {
                    let thisAnchor = comparisonAnchorPoints[i];

                    blockAnchorPathCommands.push("M");
                    blockAnchorPathCommands.push(that._scaleBasesToPixels(referenceAnchorPoints[i]));
                    blockAnchorPathCommands.push(",0V");
                    blockAnchorPathCommands.push(that._trackHeight);
                    blockAnchorPathCommands.push("L");
                    blockAnchorPathCommands.push(that._scaleCompToRefBases[that._anchorPoints][currBlock.symbol](thisAnchor));
                    blockAnchorPathCommands.push(",");
                    blockAnchorPathCommands.push(that._trackHeight + (that._height * 0.05));
                    blockAnchorPathCommands.push("L");
                    blockAnchorPathCommands.push(that._scaleCompToRefBases[that._anchorPoints][currBlock.symbol](thisAnchor));
                    blockAnchorPathCommands.push(",");
                    blockAnchorPathCommands.push((2 * that._trackHeight) + (that._height * 0.05));
                }
                that._anchorPathCommands.push(blockAnchorPathCommands.join(""));

                if (blockAnchorPathCommands.length > 0) {
                    that._anchorGrp
                        .append("path")
                        .attr("d", blockAnchorPathCommands.join(""));
                }

            });

            // deep array copying for more efficiency
            for (let i = 0; i < that._anchorPathCommands.length; i++) {
                that._transAnchorPathCommands[i] = that._anchorPathCommands[i];
            }
        };

        /**
         * defines tooltip behavior and draws the block coordinates so that block
         * end points are right justified and block start points are left justified
         */
        BlockViewBrowser.prototype.drawBlockCoordinates = function() {
            let that = this;

            // by default, hide the tooltip
            that._refBlockTip.hide();
            that._compBlockTip.hide();

            // < number of coords per block = 2 > *
            // < average width of a character = 5 > *
            // <maximum number of characters in a coord = 20 > = 200
            let minWidthForLabels = 200;

            // remove tooltip events until we have an updated list
            // of blocks that should get the tooltip
            that._referenceBlocksGrp.selectAll("rect")
                .on("mouseover", null);

            that._comparisonBlocksGrp.selectAll("rect")
                .on("mouseover", null);

            // only apply tooltip events to reference blocks that are too
            // small for labels
            that._referenceBlocksGrp.selectAll("rect")
                .filter(function(d) {
                    return ((that.calculateNewWidth(d) <= minWidthForLabels) || d.qtl_id);
                })
                .on("mouseover", that._refBlockTip.show)
                .on("mousemove", function() { // tooltip follows mouse
                    return that._refBlockTip
                        .style("top",(d3.event.pageY-10)+"px")
                        .style("left",(d3.event.pageX+10)+"px");
                })
                .on("mouseout", that._refBlockTip.hide);

            // only apply tooltip events to comparison blocks that are too
            // small for labels
            that._comparisonBlocksGrp.selectAll("rect")
                .filter(function(d) {
                    return that.calculateNewWidth(d) <= minWidthForLabels;
                })
                .on("mouseover", that._compBlockTip.show)
                .on("mousemove", function() { // tooltip follows mouse
                    return that._compBlockTip
                        .style("top",(d3.event.pageY-10)+"px")
                        .style("left",(d3.event.pageX+10)+"px");
                })
                .on("mouseout", that._compBlockTip.hide);

            // {pos: ref coordinate, type: start or end}
            let refCoords = [];

            // {pos: ref coordinate, chr: comp chromosome, base: comp coordinate type: start or end}
            let compCoords = [];

            // generate list of blocks that are wide enough to support
            // labels
            that._referenceBlocksGrp.selectAll("rect")
                .filter(function(d) {
                    return that.calculateNewWidth(d) > minWidthForLabels && !d.qtl_id;
                })
                .attr("class", function(d) {
                    refCoords.push({
                        start_pos: d.start_pos,
                        type: "start"
                    });
                    refCoords.push({
                        start_pos: d.end_pos,
                        type: "end"
                    });

                    if(that._anchorPoints === "trueAnchorPoints" && !d.orientation_match) {
                        compCoords.push({
                            start_pos: d.end_pos,
                            chr: d.chr,
                            base: d.comp_start,
                            type: "end"
                        });

                        compCoords.push({
                            start_pos: d.start_pos,
                            chr: d.chr,
                            base: d.comp_end,
                            type: "start"
                        });
                    } else {
                        compCoords.push({
                            start_pos: d.start_pos,
                            chr: d.chr,
                            base: d.comp_start,
                            type: "start"
                        });
                        compCoords.push({
                            start_pos: d.end_pos,
                            chr: d.chr,
                            base: d.comp_end,
                            type: "end"
                        });
                    }

                    return "reference";
                });

            that._referenceBlockCoordinates.selectAll("text")
                .data(refCoords)
                .enter()
                .append("text")
                .attr("font-size", "12px")
                .attr("text-anchor", function(d) { return d.type })
                .text(function(d) { return format(Math.round(d.start_pos)) });

            that._comparisonBlockCoordinates.selectAll("text")
                .data(compCoords)
                .enter()
                .append("text")
                .attr("font-size", "12px")
                .attr("text-anchor", function(d) { return d.type; })
                .text(function(d) {
                    return "Chr" + d.chr + ":" + (format(Math.round(d.base))) });

        };

        // Updating                 ////////////////////////////////////////////
        ////////////////////////////////////////////////////////////////////////
        /**
         * updates scales and makes translations
         */
        BlockViewBrowser.prototype.updateScaling = function() {
            let that = this;

            // set the current zoom scale
            that._zoomTracks.scale(that._intervalChanges.newScaleFactor);

            // set the current zoom translation vector
            that._zoomTracks.translate([that._intervalChanges.newX, that._comparisonOffsetY]);
            that._zoomOverlay.translate([that._intervalChanges.newScaleFactor, that._comparisonOffsetY]);
        };

        /**
         * applies needed transformations for positioning elements to their appropriate
         * positions on the reference track - elements landing outside of the svg's
         * viewport, are not rendered at all (for performance reasons)
         */
        BlockViewBrowser.prototype.updateReferenceTrack = function() {
            let that = this;

            // syntenic blocks: transformation and rendering
            that._referenceBlocksGrp.selectAll("rect")
                .attr("x", function (d) { return that.calculateNewX(d); })
                .attr("width", function (d) { return that.calculateNewWidth(d); });

            // make QTL ranges visible when zoomed out
            that._referenceBlocksGrp.selectAll(".qtl")
                .attr("width", function (d) {
                    let newWidth = that.calculateNewWidth(d);
                    if(newWidth < 1) { return 1; }
                    return newWidth;
                });

            // hide all genes
            that._referenceGeneData.selectAll("g")
                .attr("display", "none");

            // boolean value: check if all genes positioned in view need to be visible or   
            // just those that have passed the filtering criteria (in case the boolean is true) 
            let showOnlyFilteredFeatures = JaxSynteny.blockViewFilterMng.showOnlyFilteredFeatures();

            let visibleFeatures = [];
            if(showOnlyFilteredFeatures) {
                visibleFeatures = that.getmatchedFilterFeaturesId().slice();
                // genome view selected genes must be visible (if positioned in view) 
                for(let g of JaxSynteny.highlightedFeatures.gene) {
                    // it is ok if some ids repeat (since they might be in the filtered gene list as well)
                    visibleFeatures.push(g.gene_id);
                }
            }

            // gene data is visible only if the gene is positioned within the viewport
            let visible = that._referenceGeneData.selectAll(that.blockSelector)
                .filter(function(d) {
                    let geneStart = that.calculateNewX(d);
                    let geneEnd = geneStart + that.calculateNewWidth(d);
                    if(showOnlyFilteredFeatures) {
                        if(visibleFeatures.indexOf(d.gene_id) > -1) {
                            return isWithinView(that, geneStart, geneEnd);
                        } else { 
                            return false;
                        }
                    } else {
                        return isWithinView(that, geneStart, geneEnd);
                    }
                })
                .attr("transform", function(d) { return "translate(" + that.calculateNewX(d) + ", " + d.ypos + ")"; })
                .attr("display", "initial");

            visible.selectAll("text")
                .attr("visibility", "hidden");

            // determining whether to show labels or not
            if(that._referenceInterval.size > SynUtils.hideElementCutoff) {
                if(that._checkboxShowLabels.is(":checked")) {
                    visible.selectAll("text")
                        .attr("visibility", "visible");
                }
                else {
                    // show highlighted labels, if any
                    that._highlightedGenes.forEach(function(e) {
                        visible.selectAll("text")
                            .filter(function(f) { return (f.homolog_id === e) })
                            .attr("visibility", "visible");
                    });

                    // show filtered labels, if any
                    that.getmatchedFilterFeatures().forEach(function(e) {
                        visible.selectAll("text")
                            .filter(function(f) { return f.gene_id === e.gene_id; })
                            .attr("visibility", "visible");
                    });
                }
            }
            else {
                visible.selectAll("text")
                    .attr("visibility", "visible");
            }

            // features: transformation and rendering
            visible.selectAll(".gene")
                .attr("width", function(d) { return Math.abs(that.calculateNewWidth(d)); });


            return visible;
        };

        /**
         * applies needed transformations for positioning elements to their appropriate
         * positions on the comparison track - elements landing outside of the svg's
         * viewport, are not rendered at all (for performance purposes)
         */
        BlockViewBrowser.prototype.updateComparisonTrack = function() {
            let that = this;

            // syntenic blocks: transformation and rendering
            that._comparisonBlocksGrp.selectAll("rect")
                .attr("x", function(d) { return that.calculateNewX(d); })
                .attr("width", function(d) { return that.calculateNewWidth(d); });

            // hide all genes
            that._comparisonGeneData.selectAll("g")
                .attr("display", "none");

            // boolean value: check if all genes positioned in view need to be visible or   
            // just those that have passed the filtering criteria (in case the boolean is true) 
            let showOnlyFilteredFeatures = JaxSynteny.blockViewFilterMng.showOnlyFilteredFeatures();

            let visibleFeatures = [];
            if(showOnlyFilteredFeatures) {
                visibleFeatures = that.getmatchedFilterFeaturesId().slice();

                // genome view selected genes must be visible (if positioned in view)
                JaxSynteny.highlightedFeatures.gene.forEach(function(e) {
                    // push the comparison homologs of the highlighted features to be marked to be kept visible
                    if(that._referenceToComparison[e.gene_id]) {
                        let comparisonFeatures = that._referenceToComparison[e.gene_id].homologs
                            .map(function(g) { return g.gene_id; });

                        visibleFeatures.push(...comparisonFeatures);
                    }
                });
            }

            // gene data is visible only if the gene is positioned within the viewport
            let visible = that._comparisonGeneData.selectAll(that.blockSelector)
                .filter(function(d) {
                    let geneStart = that.calculateNewScaledX(d);
                    let geneEnd = geneStart + that.calculateNewScaledWidth(d);
                    if(showOnlyFilteredFeatures) {
                        if(visibleFeatures.indexOf(d.gene_id) > -1) {
                            return isWithinView(that, geneStart, geneEnd);
                        } else { 
                            return false;
                        }
                    } else {
                        return isWithinView(that, geneStart, geneEnd);
                    }
                })
                .attr("transform", function(d) {
                    return "translate(" + that.calculateNewScaledX(d) + ", " + d.ypos + ")";
                })
                .attr("display", "initial");

            visible.selectAll("text")
                .attr("visibility", "hidden");

            // determining whether to show labels or not
            if(that._referenceInterval.size > SynUtils.hideElementCutoff) {
                if(that._checkboxShowLabels.is(":checked")) {
                    visible.selectAll("text")
                        .attr("visibility", "visible");
                }
                else {
                    // show highlighted labels, if any
                    that._highlightedGenes.forEach(function(e) {
                        visible.selectAll("text")
                            .filter(function(f) {
                                let isHighlighted = false;

                                f.homolog_ids.forEach(function(g) {
                                    if (!isHighlighted) { isHighlighted = (g === e) }
                                });
                                return isHighlighted
                            })
                            .attr("visibility", "visible");
                    });

                    // show filtered labels, if any
                    that.getmatchedFilterFeatures().forEach(function(e) {
                        visible.selectAll("text")
                            .filter(function(f) { return f.gene_id === e.gene_id; })
                            .attr("visibility", "visible");
                    });
                }
            }
            else {
                visible.selectAll("text")
                    .attr("visibility", "visible");
            }

            // features: transformation and rendering
            visible.selectAll(".gene")
                .attr("width", function(d) { return Math.abs(that.calculateNewScaledWidth(d)); });


            return visible;
        };

        /**
         * updates position values for anchors
         */
        BlockViewBrowser.prototype.updateAnchors = function() {
            let that = this;

            that._anchorGrp.selectAll("*").remove();

            if(that._checkboxShowAnchors.is(":checked")) {
                let newPathCommands = [];

                /*
                The way that svg paths are constructed are with commands:
                M - moveto: specifies the coordinate value where the path will begin
                L - lineto: draws a line to a specified coordinate value
                V - verticallineto: draws a vertical line of a specified length

                The way that each anchor is formatted is the following:
                M<refX>,<refTop>V<trackHeight>L<compX>,<compTop>L<compX>,<trackHeight>
                */

                // update all of the x values for all of the vertical lines in the anchors
                that._anchorPathCommands.forEach(function (command) {
                    let blockCommands = command.split("M");
                    blockCommands.shift();

                    let newBlockCommands = [];
                    // get each anchor in the block
                    blockCommands.forEach(function (subcom) {
                        let subCommand = subcom.split("L");

                        let newSubCommand = [];
                        // get the x,y values for each vertical line of the anchor
                        subCommand.forEach(function (transition) {
                            let transitions = transition.split(",");

                            // apply the changes to each of the x values
                            let newTrans = (that._intervalChanges.newScaleFactor * transitions[0]) +
                                            that._intervalChanges.newX;
                            transitions[0] = newTrans.toString();

                            newSubCommand.push(transitions.join(","));
                        });

                        newBlockCommands.push(newSubCommand.join("L"));
                    });
                    newPathCommands.push("M" + newBlockCommands.join("M"));


                });

                newPathCommands.forEach(function (command, i) {
                    let compBlock = that._syntenicBlocks[i][that._anchorPoints].compAnchorPoints.chr;
                    that._anchorGrp.append("path")
                        .attr("d", command)
                        .attr("class", "inner-anchor")
                        .attr("stroke", that._colors[compBlock])
                        .attr("stroke-width", 0.1);
                });

                that._transAnchorPathCommands = newPathCommands;
            }
        };

        /**
         * updates the visibility and position values of the block coordinates
         */
        BlockViewBrowser.prototype.updateBlockCoordinates = function() {
            let that = this;

            // translate the ref coordinates
            that._referenceBlockCoordinates.selectAll("text")
                .attr("x", function(d) { return that.calculateNewX(d); });

            // translate the comp coordinates
            that._comparisonBlockCoordinates.selectAll("text")
                .attr("x", function(d) { return that.calculateNewX(d); });

        };

        ////////////////////////////////////////////////////////////////////////
        // Color Legend Functions
        ////////////////////////////////////////////////////////////////////////
        /**
         * draws the color legend below the tracks
         */
        BlockViewBrowser.prototype.drawColorLegend = function() {
            let that = this;

            that._comparisonChromosomes = [];
            that._syntenicBlocks.forEach(function(d) {
                let val = d.matchAnchorPoints.compAnchorPoints.chr;
                if (jQuery.inArray(val, that._comparisonChromosomes) === -1) {
                    that._comparisonChromosomes.push(val);
                }
            });

            that._colorlegend = new ColorLegend.ColorLegendFactory(comparisonSpecies.id);

            $("#color-key").css("display", "block");
            $("#block-view-panel-body").css("height", "700px");

            that._colorlegend.drawLegend(that._comparisonChromosomes);
        };

        ////////////////////////////////////////////////////////////////////////
        // Species Label Functions
        ////////////////////////////////////////////////////////////////////////
        /**
         * generates the labels for the blocks
         */
        BlockViewBrowser.prototype.drawSpeciesLabels = function () {
            let that = this;

            let labelOffset = that._trackHeight+that._comparisonOffsetY;
            // creates a group and rotates 270 degrees
            that._speciesLabels = that._blockView
                .append("g")
                .attr("id", "labels")
                .attr("transform", "rotate(270), " +
                                   "translate(" + (-labelOffset) + " 0)");

            that._speciesLabels
                .append("rect")
                .attr("width", ((2 * that._trackHeight) + (that._height*0.05)))
                .attr("height", 25)
                .attr("fill", SynUtils.fadeColor("#FFF", 0.5));

            // appends comparison label to group
            that._speciesLabels
                .append("text")
                .attr("id", "comparison-label")
                .attr("class", "genome-label")
                .attr("transform", "translate(0 15)")
                .text(that.abbreviateSpecies("comp"));

            // appends reference label to group
            that._speciesLabels
                .append("text")
                .attr("id", "reference-label")
                .attr("class", "genome-label")
                .attr("transform", "translate(" + (that._trackHeight+(that._height*0.05)) + " 15)")
                .text(that.abbreviateSpecies("ref"));

        };

        /**
         * replaces the full species name with an abbreviated version to shorten it for labels
         *
         * @param {string} refOrCompSpecies - string containing either "ref" of "comp"
         * @return {string || null} - species abbreviation
         */
        BlockViewBrowser.prototype.abbreviateSpecies = function (refOrCompSpecies) {
            let speciesName;
            if (refOrCompSpecies === "ref") {
                speciesName = referenceSpecies.name;
            }
            else if (refOrCompSpecies === "comp") {
                speciesName = comparisonSpecies.name;
            }
            else {
                console.log(refOrCompSpecies + " is not a valid type");
                return null;
            }
            return speciesName.charAt(0) + ". " +
                speciesName.split(" ").pop();
        };

        ////////////////////////////////////////////////////////////////////////
        // Calculation Functions
        ////////////////////////////////////////////////////////////////////////
        /**
         * updates, converts and formats coordinate values
         */
        BlockViewBrowser.prototype.calculateCoordinateValues = function() {
            let that = this;

            // by default, don't display coordinates, later we'll determine if we should show them
            that._comparisonCoordinates.attr("display", "none");

            let startPos = null;
            let startBlock = null;
            let endPos = null;
            let endBlock = null;
            let listForEndPoint = that.syntenicBlockEndpoints.asc;
            let listForStartPoint = that.syntenicBlockEndpoints.desc;

            listForEndPoint.forEach(function(point, i, points) {
                if(!endPos && that._referenceInterval.endPos <= point.loc) {
                    if(point.lessThan) {
                        endPos = that._referenceInterval.endPos;
                        endBlock = point.lessThan;
                    } else {
                        endPos = points[i - 1].loc;
                        endBlock = points[i - 1].lessThan;
                    }
                }
            });

            if(!endPos) {
                endPos = listForStartPoint[0].loc;
                endBlock = listForStartPoint[0].lessThan;
            }

            listForStartPoint.forEach(function(point, i, points) {
                if(!startPos && that._referenceInterval.startPos >= point.loc) {
                    if(point.greaterThan) {
                        startPos =  that._referenceInterval.startPos;
                        startBlock = point.greaterThan;
                    } else {
                        startPos = points[i - 1].loc;
                        startBlock = points[i - 1].greaterThan;
                    }
                }
            });

            if(!startPos) {
                startPos = listForEndPoint[0].loc;
                startBlock = listForEndPoint[0].greaterThan;
            }

            // only calculate and display comparison points if the two reference points aren't in between two syntenic
            // blocks
            if(startPos < endPos) {
                let compCoords = [];
                let data = [{
                    pos: startPos,
                    block: that.syntenicBlockLookup[startBlock]
                }, {
                    pos: endPos,
                    block: that.syntenicBlockLookup[endBlock]
                }];

                data.forEach(function(e) {
                    let coord = null;
                    // if the interval position is a start/end, just set it to the comp start/end rather than calculate
                    if(e.pos === e.block.start_pos) {
                        coord = e.block.comp_start;
                    } else if(e.pos === e.block.end_pos) {
                        coord = e.block.comp_end;
                    } else {
                        // this takes into orientation into consideration. If comp_start is greater than comp_end,
                        // scale_to_comp will be negative
                        coord = e.block.comp_start + ((e.pos - e.block.start_pos) * e.block.scale_to_comp);
                    }

                    compCoords.push(coord);
                });

                that._comparisonCoordinates.attr("display", "initial");
                let refCoords = [that._referenceInterval.startPos, that._referenceInterval.endPos];
                that._refCoordinates.forEach(function(e, i) {
                        e.text("Chr" + that._referenceInterval.chr + ":" + format(Math.round(refCoords[i])))
                    });

                that._compCoordinates.forEach(function(e, i) {
                        e.text("Chr" + data[i].block.chr + ":" + format(Math.round(compCoords[i])))
                    });
            }
        };

        /**
         * calculates the best possible interval to fit the given chromosome,
         * rounding to nearest 5mb
         *
         * @return {number} - tick interval for axis
         */
        BlockViewBrowser.prototype.calculateTickInterval = function () {
            let that = this;
            let rawInterval = that.calculateMaxBase() / Math.pow(10, 8);
            let integerVal = Math.floor(rawInterval);
            let decimalVal = Math.round((rawInterval - integerVal)*100)/100;
            let newInterval;
            if (decimalVal > 0.1 && decimalVal < 0.8) {
                newInterval = integerVal + 0.5;
            }
            else if (decimalVal <= 0.2) {
                newInterval = integerVal;
            }
            else {
                newInterval = integerVal + 1;
            }

            return Math.round(newInterval * Math.pow(10, 7));
        };

        /**
         * calculates the new scale factor and horizontal translation of an interval change
         */
        BlockViewBrowser.prototype.calculateTransformationData = function() {
            let that = this;

            // transformation scale factor calculation
            let newScaleFactor = that._width /
                                 that._scaleBasesToPixels(that._referenceInterval.endPos -
                                                          that._referenceInterval.startPos);
            // calculation x-position translation value; 0 is the position on the viewport
            let xTranslation = -newScaleFactor *
                               that._scaleBasesToPixels(that._referenceInterval.startPos);

            that._intervalChanges = {
                newScaleFactor: newScaleFactor,
                newX: xTranslation
            };
        };

        /**
         * calculates the new x value after interval change
         *
         * @param {Object} d - data for the given object
         * @param {number} d.start_pos - starting position for object in bases
         * @param {number} d.end_pos - ending position for object in bases
         * @return {number} - scaled and translated x value for the element
         */
        BlockViewBrowser.prototype.calculateNewX = function(d) {
            let that = this;
            return (that._intervalChanges.newScaleFactor *
                    that._scaleBasesToPixels(d.start_pos) +
                    that._intervalChanges.newX);
        };

        /**
         * calculates the x-value of an element: gene, exon, label, etc. on the comparison track
         *
         * @param {Object} coordData - object containing the data to calculate the result
         * @param {number} coordData.start_pos - element's start position on the chromosome
         * @param {number} coordData.end_pos - element's end position on the chromosome
         * @param {string} coordData.block_id - ID of the syntenic block that this element belongs to
         * @param {boolean} coordData.strand_match - if the strands match or not
         * @return {number} coordPos - scaled, translated and converted x-value for this element
         */
        BlockViewBrowser.prototype.calculateNewScaledX = function(coordData) {
            let that = this;
            let coordPos = null;

            if(that._anchorPoints === "matchAnchorPoints") {
                if (!coordData.strand_match) {
                    coordPos = that._intervalChanges.newScaleFactor *
                        that._scaleCompToRefBases[that._anchorPoints][coordData.block_id](coordData.end_pos) +
                        that._intervalChanges.newX;
                } else {
                    coordPos = that._intervalChanges.newScaleFactor *
                        that._scaleCompToRefBases[that._anchorPoints][coordData.block_id](coordData.start_pos) +
                        that._intervalChanges.newX;
                }
            } else {
                // if we're showing true anchor points, the strand_match doesn't matter
                coordPos = that._intervalChanges.newScaleFactor *
                        that._scaleCompToRefBases.trueAnchorPoints[coordData.block_id](coordData.start_pos) +
                        that._intervalChanges.newX;
            }

            return coordPos;
        };

        /**
         * calculates the new width after interval change
         *
         * @param {Object} d - data for the given object
         * @param {number} d.start_pos - starting position for object in bases
         * @param {number} d.end_pos - ending position for object in bases
         * @return {number} - scaled width for the element
         */
        BlockViewBrowser.prototype.calculateNewWidth = function(d) {
            let that = this;
            return (that._intervalChanges.newScaleFactor *
                        that._scaleBasesToPixels(d.end_pos) +
                        that._intervalChanges.newX) -
                   (that._intervalChanges.newScaleFactor *
                        that._scaleBasesToPixels(d.start_pos) +
                        that._intervalChanges.newX);
        };

        /**
         * calculates the x-value of an element: gene, exon, label, etc. on the comparison track
         *
         * @param {Object} coordData - object containing the data to calculate the result
         * @param {number} coordData.start_pos - element's start position on the chromosome
         * @param {number} coordData.end_pos - element's end position on the chromosome
         * @param {string} coordData.block_id - ID of the syntenic block that this element belongs to
         * @param {boolean} coordData.strand_match - if the strands match or not
         * @return {number} calculation - scaled element width
         */
        BlockViewBrowser.prototype.calculateNewScaledWidth = function(coordData) {
            let that = this;
            let calculation;

            if(!coordData.strand_match) {
                calculation = (that._intervalChanges.newScaleFactor *
                            that._scaleCompToRefBases[that._anchorPoints][coordData.block_id](coordData.start_pos) +
                            that._intervalChanges.newX) -
                       (that._intervalChanges.newScaleFactor *
                            that._scaleCompToRefBases[that._anchorPoints][coordData.block_id](coordData.end_pos) +
                            that._intervalChanges.newX);

            } else {
                calculation = (that._intervalChanges.newScaleFactor *
                            that._scaleCompToRefBases[that._anchorPoints][coordData.block_id](coordData.end_pos) +
                            that._intervalChanges.newX) -
                       (that._intervalChanges.newScaleFactor *
                            that._scaleCompToRefBases[that._anchorPoints][coordData.block_id](coordData.start_pos) +
                            that._intervalChanges.newX);
            }

            return calculation;
        };

        /**
         * gets width of the current reference chromosome
         *
         * @return {number || null} - number of bases in the reference chromosome
         */
        BlockViewBrowser.prototype.calculateMaxBase = function () {
            return SynUtils.getMaxBase(this._referenceInterval.chr);
        };

        /**
         * creates a data structure that stores for each QTL data that will determine it's height
         * and y position in the rendering process
         *
         * @param {Array} QTLs - QTLs that need to be arranged
         * @param {Array} QTLPoints - positions in bp that a block is starting or ending
         * @param {Object} pointData - data on each QTL point (ids and whether it's starting or ending)
         * @return {Object} QTLsArranged - data for each QTL including:
         *                                  numLanes - divide trackHeight by this value for height,
         *                                  lane - use to multiply by height of QTL to get y-position
         */
        BlockViewBrowser.prototype.getQTLPlacement = function(QTLs, QTLPoints, pointData) {
            // keeps track of qtls that have been assigned a lane
            let QTLsArranged = {};

            // lanes is an array representing vertically stacked spaces (lanes) that can be allotted to QTLs
            // lanes must always have at least one element; default state is one false element to indicate
            // that there is currently one lane and it's available for allotment
            let lanes = [false];

            // keeps track of how many lanes are currently in use
            let activeLanes = 0;

            let hasNext = function(index) {
                if(typeof lanes[index] === "undefined") {
                    return false;
                }
                else if(lanes[index]) {
                    return true;
                }
                else {
                    return hasNext(index+1);
                }
            };

            let QTLsToWatch = [];
            let maxLanesToWatch = 0;

            QTLPoints.forEach(function(e) {
                let data = pointData[e];
                data.forEach(function(f) {
                    if(f.type > 0) {
                        let laneData = {};
                        let QTLAssigned = false;
                        lanes.forEach(function(g, i) {
                            if(!g && !QTLAssigned) {
                                lanes[i] = f.qtl_id;
                                QTLAssigned = true;
                                laneData.lane = i;
                            }
                        });

                        if(!QTLAssigned) {
                            lanes.push(f.qtl_id);
                            laneData.lane = lanes.indexOf(f.qtl_id);
                        }

                        QTLsArranged[f.qtl_id] = laneData;
                        QTLsToWatch.push(f.qtl_id);
                    }
                    else {
                        let laneToClear = QTLsArranged[f.qtl_id].lane;
                        lanes[laneToClear] = false;

                        if(lanes.length > 1) {
                            for(let i = 0; i < lanes.length; i++) {
                                if(!hasNext(i)) {
                                    lanes.splice(i, 1);
                                }
                            }
                        }
                    }
                    activeLanes += f.type;
                    if(activeLanes > maxLanesToWatch) {
                        maxLanesToWatch = activeLanes;
                    }
                    if(activeLanes === 0) {
                        QTLsToWatch = [];
                        maxLanesToWatch = 0;
                    }
                    else if(f.type > 0){
                        QTLsToWatch.forEach(function(g) {
                            if(!QTLsArranged[g].numLanes || QTLsArranged[g].numLanes < maxLanesToWatch) {
                                QTLsArranged[g].numLanes = maxLanesToWatch;
                            }
                        });
                    }
                });
            });
            return QTLsArranged;
        };

        /**
         * collects data for the arrangement of QTLs
         */
        BlockViewBrowser.prototype.arrangeQTLs = function() {
            let that = this;
            // list of points of interest for QTLs (e.g. start, stop, overlap points)
            let QTLPoints = [];

            // keeps track of what happens at each point; qtl_id of qtl involved and
            // type is 1 (QTL starting) or -1 (QTL ending)
            let QTLPointData = {};

            // check a QTL point and add data if not yet entered
            let checkPoint = function(point, QTL, type) {
                if(QTLPoints.indexOf(point) === -1) {
                    QTLPoints.push(point);
                    QTLPointData[point] = [{qtl_id: QTL.qtl_id, type: type}];
                }
                else {
                    let isDuplicate = false;
                    QTLPointData[point].forEach(function(f) {
                        if(f.qtl_id === QTL.qtl_id && f.type === type) {
                            isDuplicate = true;
                        }
                    });

                    if(!isDuplicate) {
                        QTLPointData[point].push({qtl_id: QTL.qtl_id, type: type})
                    }
                }
            };

            that._QTLArrangeData = null;

            if(that._highlightedQTLs.length > 1) {
                //get start and stop points of each QTL
                that._highlightedQTLs.forEach(function(e) {
                    let start = e.start_pos;
                    let end = e.end_pos;

                    // check each endpoint of QTL
                    checkPoint(start, e, 1);
                    checkPoint(end, e, -1);
                });

                // check for overlaps in QTLs
                for(let i = 0; i < that._highlightedQTLs.length-1; i++) {
                    for(let j = i+1; j < that._highlightedQTLs.length; j++) {
                        let QTL1 = that._highlightedQTLs[i];
                        let QTL2 = that._highlightedQTLs[j];
                        if (QTL1.qtl_id !== QTL2.qtl_id) {
                            let overlap = SynUtils.compareRanges(QTL1, QTL2);
                            // if an overlap is found, add the overlap start and stop points if
                            // they're not already in the list
                            if (overlap) {
                                if(QTLPoints.indexOf(overlap.start) === -1) {
                                    QTLPoints.push(overlap.start);
                                    QTLPointData[overlap.start] = {type: 1};
                                }
                                
                                if(QTLPoints.indexOf(overlap.end) === -1) {
                                    QTLPoints.push(overlap.end);
                                    QTLPointData[overlap.end] = {type: -1};
                                }
                            }
                        }
                    }
                }

                // sort in numerical order so we process left to right
                QTLPoints.sort(function(a, b){return a - b});
                that._QTLArrangeData = that.getQTLPlacement(that._highlightedQTLs, QTLPoints, QTLPointData);
            }
        };

        ////////////////////////////////////////////////////////////////////////
        // Block View Navigation Functions
        ////////////////////////////////////////////////////////////////////////
        /**
         * sets block view navigation behaviors
         */
        function blockViewNavigation(that) {
            $(document).keydown(function(e) {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    if (e.key === "ArrowLeft") {
                        panView(that, "-")
                    }
                    else if (e.key === "ArrowRight") {
                        panView(that, "+")
                    }

                    that.changeInterval("5");
                }
            });

            $(".nav-button").on("click", function() {
                let id = $(this).attr("id");

                switch (id) {
                    case "pan-left":
                        panView(that, "-");
                        break;
                    case "zoom-in":
                        zoomView(that, "+");
                        break;
                    case "reset-view":
                        resetView(that);
                        break;
                    case "zoom-out":
                        zoomView(that, "-");
                        break;
                    case "pan-right":
                        panView(that, "+");
                        break;
                }

                that.changeInterval("5");
            })
        }

        /**
         * moves view left or right
         *
         * @param {Object} that - reference to block view browser
         * @param {string} panDirection - plus or minus indicating direction
         */
        function panView(that, panDirection) {
            let interval = that._referenceInterval;

            let basesToShift = Math.round(interval.size * that._preferences.pan);
            let maxBase = that.calculateMaxBase();

            if (panDirection === "+") {
                if ((interval.endPos + basesToShift) > maxBase) {
                    basesToShift = maxBase - interval.endPos;
                }
                moveRight(that, basesToShift);
            }
            else if (panDirection === "-") {
                if ((interval.startPos - basesToShift) < 0) {
                    basesToShift = interval.startPos;
                }
                moveLeft(that, basesToShift);
            }
        }

        /**
         * zooms view in or out
         *
         * @param {Object} that - reference to block view browser
         * @param {string} zoomDirection - plus or minus indicating in or out
         */
        function zoomView(that, zoomDirection) {
            let interval = that._referenceInterval;

            let minWidth = that._preferences.minWidth;
            let maxWidth = that.calculateMaxBase();
            let viewWidth = interval.endPos - interval.startPos;

            if (zoomDirection === "+") {
                if (interval.size !== minWidth) {
                    let newWidth = Math.round(interval.size * that._preferences.zoom.in);
                    let basesToZoom;
                    if (newWidth >= minWidth) {
                        basesToZoom = Math.round((viewWidth - newWidth) / 2);
                    }
                    else {
                        basesToZoom = Math.round((viewWidth - minWidth) / 2);
                    }
                    zoomIn(that, basesToZoom);
                }
            }
            else if (zoomDirection === "-") {
                if (interval.size !== maxWidth) {
                    let newWidth = Math.round(interval.size * that._preferences.zoom.out);
                    let basesToZoom;
                    if (viewWidth <= maxWidth) {
                        basesToZoom = Math.round((newWidth - viewWidth) / 2);
                    }
                    else {
                        basesToZoom = Math.round((maxWidth - viewWidth) / 2);
                    }
                    zoomOut(that, basesToZoom);
                }
            }

            that._referenceInterval.size = that._referenceInterval.endPos -
                                           that._referenceInterval.startPos;
        }

        /**
         * resets view to show all features, if any, and entire chr if none
         *
         * @param {Object} that - reference to block view browser
         */
        function resetView(that) {
            that._referenceInterval = that._resetToOrigInterval;
        }

        /**
         * moves view left
         *
         * @param {Object} that - reference to block view browser
         * @param {number} bases - number of bases to shift
         */
        function moveLeft(that, bases) {
            that._referenceInterval.startPos -= bases;
            that._referenceInterval.endPos -= bases;
        }

        /**
         * moves view right
         *
         * @param {Object} that - reference to block view browser
         * @param {number} bases - number of bases to shift
         */
        function moveRight(that, bases) {
            that._referenceInterval.startPos += bases;
            that._referenceInterval.endPos += bases;
        }

        /**
         * zooms view in
         *
         * @param {Object} that - reference to block view browser
         * @param {number} bases - number of bases to zoom
         */
        function zoomIn(that, bases) {
            let interval = that._referenceInterval;

            let newStart = interval.startPos + bases;
            let newEnd = interval.endPos - (bases + that._preferences.minWidth) + 1;

            if (newStart <= newEnd) {
                interval.startPos += bases;
                interval.endPos -= bases;
            }
        }

        /**
         * zooms view out
         *
         * @param {Object} that - reference to block view browser
         * @param {number} bases - number of bases to zoom
         */
        function zoomOut(that, bases) {
            if (that._referenceInterval.startPos - bases < 0) {
                that._referenceInterval.startPos = 0;
            }
            else {
                that._referenceInterval.startPos -= bases;
            }

            if (that._referenceInterval.endPos + bases > that.calculateMaxBase()) {
                that._referenceInterval.endPos = that.calculateMaxBase();
            }
            else {
                that._referenceInterval.endPos += bases;
            }
        }

        ///////////////////////////////////////////////////////////////////////
        // Filter Panel Functions
        ///////////////////////////////////////////////////////////////////////
        /**
         * makes the color of filtered in genes blue and filtered out genes - black;
         * genes that are currently colored in red remain red;
         * the coloring is not based on homolog pairs - it is possible that only the   
         * comparison or reference homolog(s) is/are being highlighted (in blue) 
         */
        BlockViewBrowser.prototype.highlightFilteredFeatures = function() {
            let that = this;

            // highlight any comparison track genes
            that._comparisonGeneData.selectAll("*").selectAll("*")
                .attr("fill", function(d) {
                    // all comparison gene elements need to iterate through array of HOMOLOG_IDS not homolog_id
                    let color = "black";
                    if(d.homolog_ids) {
                        d.homolog_ids.forEach(function(e) {
                            if(color === "black") {
                                color = getFeatureColor(that, e);
                            }
                        });
                    }
                    return color;
                });
            // highlight any reference track genes
            that._referenceGeneData.selectAll("*").selectAll("*")
                .attr("fill", function(d) {
                    return getFeatureColor(that, d.homolog_id);
                });
        };

        ////////////////////////////////////////////////////////////////////////
        // Helper Methods
        ////////////////////////////////////////////////////////////////////////
        /**
         * returns viewport's width
         *
         * @return {number} - width of viewport
         */
        BlockViewBrowser.prototype.getWidth = function() {
            return this._width;
        };

        /**
         * displays user message updates during application execution
         *
         * @param {string} msg - string containing the message
         * @param {string|null} [status] - possible values are either "error" or null
         */
        BlockViewBrowser.prototype.setBlockViewStatus = function(msg, status = null) {
            if(status === "error") {
                JaxSynteny.logger.changeAllStatus(msg, SynUtils.errorStatusColor)
            }
            else if(msg.toLowerCase() === "done") {
                JaxSynteny.logger.changeAllStatus(msg, SynUtils.finishedStatusColor)
            }
            else {
                JaxSynteny.logger.changeAllStatus(msg, SynUtils.processingStatusColor)
            }
        };

        /**
         * get the number of homologs for a gene to display in a tooltip
         *
         * @param {Object} that - reference to block view browser
         * @param {Object} geneData - data for specified gene
         */
        function getNumHomologs(that, geneData) {
            let homologs = "";
            if(geneData.homolog_id) {
                if(geneData.homolog_id < 0) {
                    homologs = 0
                }
                else if(that._homologIds[geneData.homolog_id].comparison.length === 0){
                    // handles if reference has a homolog that isn't shown
                    homologs = "not syntenic";
                }
                else {
                    homologs = that._homologIds[geneData.homolog_id].comparison.length;
                }
            }
            else {
                // all comparison gene elements need to iterate through array of HOMOLOG_IDS not homolog_id
                homologs = geneData.homolog_ids.length;
            }

            return homologs
        }

        /**
         * determines whether the element is within the viewport regardless of orientation (start and end reversed)
         *
         * @param {Object} that - reference to block view browser
         * @param {number} start - element's start positon on the coordinate system
		 * @param {number} end - element's end position on the coordinate system
         * @return {boolean} - whether the element is in the viewport
		 */
        function isWithinView(that, start, end) {
            return ((start < that.getWidth() || end < that.getWidth()) && (end > 0 || start > 0));
        }

        /**
         * toggles the state of the clicked gene tooltip
         *
         * @param {Object} that - reference to block view browser
         * @param {Object} data - data for the selected gene
         * @param {string} data.gene_id - id for the selected gene
         */
        function toggleToolTip(that, data) {
            if (that._clickedGene === null) {
                that._clickedGene = data.gene_id;
                that._geneClickTip.show(data);
            }
            else if (that._clickedGene !== data.gene_id) {
                that._geneClickTip.hide();
                that._clickedGene = data.gene_id;
                that._geneClickTip.show(data);
            }
            else {
                that._geneClickTip.hide();
                that._clickedGene = null;
            }
        }

        /**
         * determines feature's color based on feature's id
         * red: the feature has been selected in genome view (takes precedence over blue)
         * blue: the feature has been selected in block view filters
         * black: default feature color
         *
         * @param {Object} that - reference to block view browser
         * @param {number} homolog_id - homolog id for the feature
         * @return {string} - element's coloring
         */
        function getFeatureColor(that, homolog_id) {
            if(isInFilteredFeaturesList(that.getmatchedFilterFeatureHomologs(), homolog_id)) { return "blue"; }

            if(isInHighlightedFeaturesList(that._highlightedGenes, homolog_id)) { return "red"; }

            return "black";
        }

        /**
         * determines if the given value is in the highlighted features list
         *
         * @param {Array} highlightedFeatures - array of highlighted features (red features)
         * @param {number} homolog_id - homolog id to check
         * @return {boolean} - whether the value is found in the list
         */
        function isInHighlightedFeaturesList(highlightedFeatures, homolog_id) {
            return (highlightedFeatures.indexOf(homolog_id) > -1);
        }

        /**
         * determines if the given value is in the filtered features list
         *
         * @param {Array} filteredFeatures - array of filtered features (blue features)
         * @param {number} homolog_id - homolog id to check
         * @return {boolean} - whether the value is found in the list
         */
        function isInFilteredFeaturesList(filteredFeatures, homolog_id) {
            return (filteredFeatures.indexOf(homolog_id) > -1);
        }

        return BlockViewBrowser;
    })();

})(BlockView || (BlockView={}));