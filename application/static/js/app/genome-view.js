"use strict";

let GenomeView;

(function(GenomeView) {
    GenomeView.DataManager = (function() {
        /**
         * @constructor
         * @param {string} syntenicBlocksURL - url to get data for syntenic blocks
         */
        function DataManager(syntenicBlocksURL) {
            let genomeViewData = null;

            // make the circos plot
            this.genomeView = new GenomeView.CircosPlot();

            let that = this;
            $.when(
                $.getJSON(syntenicBlocksURL, function(data){
                    genomeViewData = {
                        referenceChrSizes: JaxSynteny.speciesRef.getChromosomeSizes(),
                        comparisonChrSizes: JaxSynteny.speciesComp.getChromosomeSizes(),
                        syntenicBlocks: data.blocks
                    };

                })
            ).then(function () {
                // render the circos plot
                that.genomeView.render(genomeViewData);

                $('#search-result').remove();
                $('#view-blocks-btn').remove();
                $('#searchterm').val("");
                $('#ref-genome-interval').val("");
            });

            // gather input from user and export svg to png file with entered name
            $("#save-genome-view").on("click", function() {
                let thisButton = $("#save-genome-view");

                //disable button and change state
                thisButton.prop("disabled", true);
                thisButton.html("Downloading...");

                // get current margin top so we can reset it after download
                let genomeViewMarginTop = d3.select("#genome-view-svg").style("margin-top");
                let genomeViewHeight = d3.select("#genome-view-svg").attr("viewBox").split(" ")[3];
                console.log(genomeViewHeight);

                // svg download functionality can't work with display none and any margin top, so reset these
                d3.select("#genome-view-legend").style("display", "block");
                d3.select("#genome-view-svg").style("margin-top", 0);

                d3.select("#genome-view-svg").append("text")
                    .attr("id", "genome-view-citation")
                    .attr("transform", "translate(10, " + (genomeViewHeight - 15) + ")")
                    .text("JAX Synteny Browser, The Jackson Laboratory, http://syntenybrowserpublic.jax.org/");

                // get svgs
                let genomeViewSVG = document.getElementById("genome-view-svg");
                let genomeViewLegend = document.getElementById("genome-view-legend");

                // get user's file name
                let enteredFileName = $("#genome-file-name").val();

                // download the svgs
                saveSvgAsPng(genomeViewSVG, (enteredFileName + ".png"));
                saveSvgAsPng(genomeViewLegend, (enteredFileName + "-legend.png"));

                // reset predownload svg settings
                d3.select("#genome-view-legend").style("display", "none");
                d3.select("#genome-view-svg").style("margin-top", genomeViewMarginTop);
                d3.select("#genome-view-citation").remove();

                // hide modal after save
                $("#genome-set-file-name").modal("hide");

                //re-enable button and change state
                thisButton.prop("disabled", false);
                thisButton.html("Save");
            });
        }

        /**
         * allows external objects to trigger an update to the plot
         */
        DataManager.prototype.identifySelectedFeatures = function() {
            this.genomeView.updateOuterPlot();
        };

        return DataManager;
    })();

    GenomeView.CircosPlot = (function() {
        /**
         * @constructor
         */
        function CircosPlot() {
            // make the dimensions scalable
            let dimension = $(".custom-panel-body").width();
            this.width = dimension;
            this.height = dimension;
            this.featuresWithNoBlock = [];

            this.svg = d3.select("#genome-view-svg")
                .attr("preserveAspectRatio", "xMinYMin meet")
                .attr("viewBox", ("0 0 " + this.width + " " + this.height));

            this.resizePanels();

            window.onresize = this.resizePanels;

        }

        /**
         * Resizes the height of the panel based on the width of the browser window
         */
        CircosPlot.prototype.resizePanels = function() {
            // Any width values here are manual breakpoints
            if($(window).width() > 1425) {
                let newHeight = $("#genome-view-svg").height() + 18;
                $(".custom-panel-body").height(newHeight);

                if($(window).width() > 1875) {
                    $('div.dataTables_scrollBody').height($(window).width() * 0.28);
                }
                else if($(window).width() > 1665){
                    $('div.dataTables_scrollBody').height($(window).width() * 0.26);
                }
                else if($(window).width() > 1575){
                    $('div.dataTables_scrollBody').height($(window).width() * 0.25);
                }
                else if($(window).width() > 1490){
                    $('div.dataTables_scrollBody').height($(window).width() * 0.24);
                }
                else {
                    $('div.dataTables_scrollBody').height($(window).width() * 0.23);
                }
            }
            else {
                let newHeight = $("#genome-view-svg").height() + 25;
                $(".custom-panel-body").height(newHeight);
            }
        };

        /**
         * generate the labels for the plot
         */
        CircosPlot.prototype.setGenomeViewLabels = function() {
            // this calculation is to set the font size to a percentage of the window width without setting it to a
            // responsive size (vw or %) which will scale the font based on the size of the window, thus always
            // being a little larger than we need. Once the SVG is fully rendered, if the window is scaled, the SVG will
            // handle the scaling. However, on load, if the window is small, a numeric size (like setting it to
            // 18px) might overlap the circos plot
            let fontSize = $(window).width() * 0.01;

            this.svg.append("text")
                .attr("transform", "translate(10, 30)")
                .style("font-size", fontSize)
                .text("Outer: " + JaxSynteny.speciesRef.name);

            this.svg.append("text")
                .attr("transform", "translate(10, 60)")
                .style("font-size", fontSize)
                .text("Inner: " + JaxSynteny.speciesComp.name);
        };

        /**
         * creates a small list to the right-hand side of the svg that lists features that are not located in a
         * syntenic block
         */
        CircosPlot.prototype.listFeaturesWithNoBlocks = function() {
            let that = this;

            // remove the previous one to re-render the new
            this.svg.select("#no-blocks").remove();

            // check if the list is long enough where it might overlap with the circos plot
            let excessFeatures = (that.featuresWithNoBlock.length - 5 > 0) ?
                that.featuresWithNoBlock.length - 5 : 0;

            let featureList = null;

            // if the list is long enough, trim it down and add a message at the end with how many aren't explicitly
            // listed and use this list instead of original
            if (excessFeatures > 0) {
                featureList = that.featuresWithNoBlock.slice(0, 6);
                featureList.push({content: "and " + excessFeatures + " more"});
            } else {
                featureList = that.featuresWithNoBlock;
            }

            featureList.unshift({content: "The following features do not have a syntenic location:"});

            // keeps track of how far in the list we are, which affects how much vertical translation should be put
            // on the element
            let i = 0;
            // iterator for vertical translation
            let yTrans = 0;

            this.svg.append("g")
                .attr("id", "no-blocks")
                .attr("transform", "translate(" + (that.width - 10) + ", 30)")
                .selectAll("text")
                .data(featureList)
                .enter()
                .append("text")
                .attr("text-anchor", "end")
                .attr("transform", function() {
                    if(i === 0) {
                        i += 1;
                        return;
                    }

                    (i === 1) ? yTrans += 22 : yTrans += 18;
                    
                    i += 1;

                    return "translate(0, " + yTrans + ")";
                })
                .attr("class", function(d) {
                    if(d.content) { return "list-head"; }

                    return "list-content";
                })
                .html(function(d) {
                    if(d.content) { return d.content; }

                    if(d.qtl_symbol) { return d.qtl_symbol + " (Chr" + d.chr + ", QTL)"; }

                    if(d.gene_symbol) { return d.gene_symbol + " (Chr" + d.chr + ", gene)"; }
                });
        };

        /**
         * sets the button and click event behaviors
         */
        CircosPlot.prototype.bindBehaviors = function() {
            let that = this;

            $("#show-block-view").prop('disabled', true);

            // genome view clear button
            $("#clear-genome-view").on("click", function() {
                // clear interval
                $("#ref-genome-interval").val("");

                that.outerPlot.clean();
                that.innerPlot.clean();
                JaxSynteny.highlightedFeatures.qtl = [];
                JaxSynteny.highlightedFeatures.gene = [];

                $("#show-block-view").prop('disabled', true);
            });

            // selection of a chromosome
            this.svg.selectAll(".outer").on("click", function(d) {

                // get the block bands for the chr render those blocks in the inner plot
                let refBands = that.outerPlot.getRefBlockBands(d.chr);
                let blocks = that.getChrBlocks(d.chr, refBands.blockBands, refBands.chrBand);

                that.updateInnerPlot(d.chr, blocks);

                // format of the chr might be "ref<chr number>" so just grab the real chr value
                d.chr = SynUtils.checkAndResetChr(d.chr);

                // update interval
                $("#ref-genome-interval").val("Chr" + d.chr + ":" + blocks.start + "-" + blocks.end);
                $("#show-block-view").prop('disabled', false);
            });


        };

        /**
         * renders the circos plot
         *
         * @param {Object} data - data from the DataManager
         * @param {Array} data.referenceChrSizes - chromosome sizes for reference genome
         * @param {Array} data.comparisonChrSizes - chromosome sizes for comparison genome
         * @param {Array} data.syntenicBlocks - object array containing syntenic block data
         * @param {string} data.syntenicBlocks[].ref_chr - block chromosome for reference
         * @param {number} data.syntenicBlocks[].ref_start_pos - block start position for reference
         * @param {number} data.syntenicBlocks[].ref_end_pos - block end position for reference
         * @param {string} data.syntenicBlocks[].comp_chr - block chromosome for comparison
         * @param {number} data.syntenicBlocks[].comp_start_pos - block start position for comparison
         * @param {number} data.syntenicBlocks[].comp_end_pos - block end position for comparison
         */
        CircosPlot.prototype.render = function(data) {
            this.genomeData = data;

            // organize data needed to style and format the blocks as arcs and chords
            let refPairs = SynUtils.makeIntervalPairs(data.referenceChrSizes);
            this.referenceData = {
                intervalPairs: refPairs,
                genoCoords: SynUtils.makeGenoCoords(refPairs, SynUtils.degToRad(2)),
                colorScheme: JaxSynteny.colors
            };

            let compPairs = SynUtils.makeIntervalPairs(data.comparisonChrSizes);
            this.comparisonData = {
                intervalPairs: compPairs,
                genoCoords: SynUtils.makeGenoCoords(compPairs, SynUtils.degToRad(2)),
                colorScheme: JaxSynteny.colors
            };

            // organize block data needed to render blocks as bands
            let refBlockBands= [];
            let compBlockBands= [];

            for(let i = 0; i < this.genomeData.syntenicBlocks.length; i++){
                let refBlock = {
                    chr: this.genomeData.syntenicBlocks[i].ref_chr,
                    startPos: this.genomeData.syntenicBlocks[i].ref_start_pos,
                    size: (this.genomeData.syntenicBlocks[i].ref_end_pos - this.genomeData.syntenicBlocks[i].ref_start_pos),
                    cytoBandType: this.comparisonData.genoCoords.chrIntervals.keyIndices[this.genomeData.syntenicBlocks[i].comp_chr],
                    index: i
                };
                refBlockBands.push(refBlock);

                let compBlock = {
                    chr: this.genomeData.syntenicBlocks[i].comp_chr,
                    startPos: this.genomeData.syntenicBlocks[i].comp_start_pos,
                    size: (this.genomeData.syntenicBlocks[i].comp_end_pos - this.genomeData.syntenicBlocks[i].comp_start_pos),
                    cytoBandType: this.comparisonData.genoCoords.chrIntervals.keyIndices[this.genomeData.syntenicBlocks[i].comp_chr],
                    index: i
                };
                compBlockBands.push(compBlock);
            }

            this.referenceData.syntenicBlocks = refBlockBands;
            this.comparisonData.syntenicBlocks = compBlockBands;

            // clear the svg
            this.svg.selectAll("*").remove();

            this.setGenomeViewLabels();

            //create and render the inner and outer plots
            this.outerPlot = new GenomeView.OuterPlot(this.referenceData, this.svg);
            this.innerPlot = new GenomeView.InnerPlot(this.comparisonData, this.svg);

            this.outerPlot.render();
            this.innerPlot.render();

            //bind the click and button events
            this.bindBehaviors();
        };

        /**
         * given a selected chromosome and an array of blocks to render, update the inner plot
         *
         * @param {string} selectedChr - selected chromosome to render data for
         * @param {Object} blocks - block data used to render chords, arcs, and labels
         */
        CircosPlot.prototype.updateInnerPlot = function(selectedChr, blocks) {
            let that = this;
            let compChrBands = that.innerPlot.getGenoIntervals().slice();
            let indexes = blocks.indexes;

            compChrBands.push(blocks.chrBand);

            // regenerate the genoCoord data with the extra band representing the reference chr
            // to map out with chords
            let updatedGenoCoords = SynUtils.makeGenoCoords(
                                        SynUtils.makeIntervalPairs(compChrBands),
                                        SynUtils.degToRad(2));

            this.innerPlot.drawLabels(compChrBands, updatedGenoCoords);

            // gather and format data from blocks to be rendered for chord rendering
            let chordData = [];
            blocks.blocks.forEach(function(e, i) {
                let newChordData = {
                    src: {
                        chr: e.chr,
                        pos: e.startPos,
                        size: e.size
                    }
                };

                let currComp = that.comparisonData.syntenicBlocks[indexes[i]];
                newChordData.dest = {
                    chr: currComp.chr,
                    pos: currComp.startPos,
                    size: currComp.size
                };
                newChordData.cytoBandType = currComp.cytoBandType;
                newChordData.index = currComp.index;

                chordData.push(newChordData);

                // add the block band to the bands that need to be rendered on the inner plot
                compChrBands.push(e);
            });

            this.innerPlot.drawChords(chordData, updatedGenoCoords);
            this.innerPlot.drawArcs(compChrBands, updatedGenoCoords);
        };

        /**
         * returns interval and blocks for the given chr and block bands
         *
         * @param {string} selectedChr - selected chromosome
         * @param {Array} blockBands - object array of block band data
         * @param {Object} chrBand - size data for the selected reference chromosome
         * @return {Object} blocks - data to be used to update the inner plot
         */
        CircosPlot.prototype.getChrBlocks = function(selectedChr, blockBands, chrBand) {
            let blocks = {
                blocks: [],
                indexes: [],
                chrBand: chrBand
            };

            // keep track of min and max of reference interval to ensure all featured blocks are shown
            selectedChr = SynUtils.checkAndResetChr(selectedChr);
            
            let start = this.referenceData.intervalPairs.assocArr[selectedChr].size;
            let end = 0;
            let refChr = "ref" + selectedChr;

            blockBands.forEach(function(e) {
                if(e.chr.length <= 2) {
                    e.chr = "ref" + e.chr;
                }
                if(e.chr === refChr) {
                    if(e.startPos < start) {
                        start = e.startPos;
                    }
                    if(e.startPos + e.size > end) {
                        end = e.startPos + e.size;
                    }
                    blocks.blocks.push(e);
                    blocks.indexes.push(e.index);
                }
            });

            // if all blocks for that chr are to be rendered, set the interval to the entire chr size
            if(blockBands.length === this.outerPlot.getRefBlockBands(selectedChr).blockBands.length) {
                start = 0;
                end = this.referenceData.intervalPairs.assocArr[selectedChr].size;
            }

            blocks.start = start;
            blocks.end = end;

            return blocks;
        };

        /**
         * updates the outer plot
         */
        CircosPlot.prototype.updateOuterPlot = function() {
            let that = this;
            let blockBandsToDraw = [];

            // reset list to be regenerated from updated highlighted features object
            that.featuresWithNoBlock = [];

            JaxSynteny.highlightedFeatures.qtl.forEach(function(e) {
                // get the block(s) that the feature is in
                let featureBlocks = that.outerPlot.getBlocks(e.chr, e.start_pos, e.end_pos);
                if(featureBlocks.length === 0) {
                    e.type = "qtl";
                    that.featuresWithNoBlock.push(e);
                }
                featureBlocks.forEach(function(e) {
                    e.chr = SynUtils.checkAndResetChr(e.chr);
                    blockBandsToDraw.push(e);
                });
            });

            JaxSynteny.highlightedFeatures.gene.forEach(function(e) {
                // get the block(s) that the feature is in
                let featureBlocks = that.outerPlot.getBlocks(e.chr, e.start_pos, e.end_pos);
                if(featureBlocks.length === 0) {
                    e.type = "gene";
                    that.featuresWithNoBlock.push(e);
                }
                featureBlocks.forEach(function(e) {
                    e.chr = SynUtils.checkAndResetChr(e.chr);
                    blockBandsToDraw.push(e);
                });
            });

            if(that.featuresWithNoBlock.length > 0) {
                that.listFeaturesWithNoBlocks();
            }

            // draw the feature blocks that stick out from the outer plot
            that.outerPlot.drawHighlightedBlocks(blockBandsToDraw);

            // draw the red indicators for each of the featured chrs
            that.outerPlot.drawIndicators();

            // handles click events on the red indicators
            this.svg.selectAll("circle").on("click", function(d) {
                let chrBand = that.outerPlot.getRefBlockBands(d.chr).chrBand;
                let blocks = that.getChrBlocks(d.chr, blockBandsToDraw, chrBand);

                that.updateInnerPlot(d.chr, blocks);

                d.chr = SynUtils.checkAndResetChr(d.chr);

                $("#ref-genome-interval").val("Chr" + d.chr + ":" + blocks.start + "-" + blocks.end);
                $("#show-block-view").prop('disabled', false);
            });
        };

        return CircosPlot;
    })();

    GenomeView.OuterPlot = (function() {
        /**
         * @constructor
         * @param {Object} referenceData - data used to render the outer plot
         * @param {Object} svg - reference to parent svg element
         */
        function OuterPlot(referenceData, svg) {
            // set up parameters for the outer plot
            this.genoData = referenceData;
            let dimension = $(".custom-panel-body").width();
            this.width = dimension;
            this.height = dimension;
            this.arcHeight = 20;
            this.genoIntervals = SynUtils.getGenoIntervals(this.genoData.intervalPairs);

            let svgRadius = Math.min(this.width / 2, this.height / 2);
            let outerRadius = Math.round((2 / 3) * svgRadius + 30);
            this.radius = {
                svg: svgRadius,
                outerRing: outerRadius,
                outerLabels: (outerRadius + 45),
                ticks: (outerRadius + this.arcHeight),
                indicators: (outerRadius - 15)
            };

            this.plot = svg.append("g")
                .attr("id", "outer-plot");

            this.legend = d3.select("#genome-view-legend")
                .attr("preserveAspectRatio", "xMinYMin meet")
                .attr("viewBox", ("0 0 " + this.width + " " + this.height));
        }

        /**
         * renders the outer plot
         */
        OuterPlot.prototype.render = function() {
            let that = this;

            that.outerRing = that.plot.append("g")
                .attr("id", "outer-ring")
                .attr("transform", "translate(" + that.radius.svg + ", " + that.radius.svg + ")");

            that.referenceChrBands = that.outerRing.append("g")
                .attr("id", "outer-chr-bands");

            that.referenceBlockBands = that.outerRing.append("g")
                .attr("id", "outer-block-bands");

            that.referenceLabels = that.outerRing.append("g")
                .attr("id", "outer-labels");

            that.featureBlocks = that.outerRing.append("g")
                .attr("id", "feature-blocks");

            that.featureIndicators = that.outerRing.append("g")
                .attr("id", "feature-indicators");

            // remove any existing tooltips
            d3.select("body").selectAll(".genome-view").remove();

            // hover tooltip for the indicators
            that.featureTip = d3.tip()
                .attr("class", "d3-tip genome-view")
                .attr("id", "feature-tip")
                .offset([-10, 0])
                .html(function(d) {
                    let tooltip = "<b>Chr:</b> " + d.chr
                                + "<br>";
                    if(d.gene_symbols.length > 0) {
                        if(d.gene_symbols.length <= 10) {
                            tooltip += "<br><b>Gene Symbols:</b>"
                                + "<br>" + d.gene_symbols.join("<br>")
                                + "<br>";
                        }
                        else {
                            tooltip += "<br><b>Gene Symbols:</b>";
                            for(let i = 0; i < 10; i++) {
                                tooltip += "<br>" + d.gene_symbols[i];
                            }
                            tooltip += "<br>" + "and " + (d.gene_symbols.length - 10) + " more" + "<br>"
                        }
                    }
                    if(d.qtl_symbols.length > 0) {
                        if(d.qtl_symbols.length <= 10) {
                            tooltip += "<br><b>QTL Symbols:</b>"
                                + "<br>" + d.qtl_symbols.join("<br>")
                                + "<br>";
                        }
                        else {
                            tooltip += "<br><b>QTL Symbols:</b>";
                            for(let i = 0; i < 10; i++) {
                                tooltip += "<br>" + d.qtl_symbols[i];
                            }
                            tooltip += "<br>" + "and " + (d.qtl_symbols.length - 10) + " more" + "<br>"
                        }
                    }

                    return tooltip;
                });

            that.featureIndicators.call(that.featureTip);

            this.drawArcs();

            this.drawLabels()
        };

        /**
         * renders arcs in the outer ring
         */
        OuterPlot.prototype.drawArcs = function() {
            let that = this;
            let innerEdge = that.radius.outerRing;
            let outerEdge = innerEdge + that.arcHeight;

            // render the chr bands (outlines for the reference chrs)
            that.referenceChrBands.selectAll("path")
                .data(that.genoIntervals)
                .enter()
                .append("path")
                .attr("id", function(d) { return "chr" + d.chr; })
                .attr("class", " outer outer-chr-band")
                .attr("d", function(d) {
                    return SynUtils.getArcPath(innerEdge, outerEdge, that.genoData.genoCoords, d);
                });

            // render all of the syntenic block bands
            that.referenceBlockBands.selectAll("path")
                .data(that.genoData.syntenicBlocks)
                .enter()
                .append("path")
                .attr("class", "outer outer-block-band")
                .attr("d", function(d) {
                    return SynUtils.getArcPath(innerEdge, outerEdge, that.genoData.genoCoords, d);
                })
                .attr("fill", function(d) {
                    return that.genoData.colorScheme[d.cytoBandType].color;
                });
        };

        /**
         * renders labels for the outer ring
         */
        OuterPlot.prototype.drawLabels = function() {
            let that = this;
            let genoCoords = that.genoData.genoCoords;
            let chrs = genoCoords.chrIntervals.keys;
            let textTransformations = [];

            // compute the positioning of the labels based on position of associated chr
            chrs.forEach(function(chr, counter) {
                let chrInterval;
                let chrMidPoint;
                let labelPos;
                let radians;

                chrInterval = genoCoords.chrIntervals.assocArr[chr];
                chrMidPoint = chrInterval.size / 2.0;
                labelPos = genoCoords.genoPosToCartesian(that.radius.outerLabels, chr, chrMidPoint);
                radians = genoCoords.genoPosToRadians(chr, chrMidPoint);

                let txtTrans = "translate(" + labelPos.x + "," + labelPos.y +
                        ")rotate(" + (90 + SynUtils.radToDeg(radians)) + ")";

                if (counter > (chrs.length / 2 - 1)) {
                    txtTrans += "rotate(90)";
                } else {
                    txtTrans += "rotate(-90)";
                }
                textTransformations.push(txtTrans);
            });

            // render the labels
            that.referenceLabels.selectAll("text")
                .data(that.genoIntervals)
                .enter()
                .append("text")
                .attr("class", "outer outer-label")
                .attr("text-anchor", "middle")
                .attr("transform", function(d, i) {
                    return textTransformations[i];
                })
                .text(function(d) {
                    return d.chr;
                })
        };

        /**
         * generates the list of features in the circos plot in the hidden svg behind the genome view
         *
         * @param {Array} featuresByChr - list of objects where features are grouped by chromosome
         */
        OuterPlot.prototype.generateLegend = function(featuresByChr) {
            let that = this;

            // clear any existing list
            that.legend.selectAll("*").remove();

            // sort the list by chromosome
            featuresByChr.sort(function(a, b) {
                if(parseInt(a.chr) && parseInt(b.chr)) {
                    return parseInt(a.chr) - (parseInt(b.chr));
                }
                if(b.chr === "Y") {
                    return -1;
                }
                if(!parseInt(a.chr)) {
                    return 1;
                }
                if(!parseInt(b.chr)) {
                    return -1;
                }
            });

            let interChrSpace = 25;
            let lineSpace = 14;
            let columnSpace = 160;
            let yValue = interChrSpace;
            let xValue = 10;

            featuresByChr.forEach(function(e) {
                // trim gene and qtl lists
                let geneExcess = 0;
                let qtlExcess = 0;
                if(e.genes.length > 15) {
                    geneExcess = e.genes.length - 15;
                    e.genes = e.genes.splice(0, 16);
                    e.genes.push({content: "and " + geneExcess + " more"});
                }

                if(e.qtls.length > 15) {
                    qtlExcess = e.qtls.length - 15;
                    e.qtls = e.qtls.splice(0, 16);
                    e.qtls.push({content: "and " + qtlExcess + " more"});
                }

                // calculate approximate height of the section using trimmed list
                let sectionHeight = lineSpace * (e.genes.length + e.qtls.length + 1);

                // if the chromosome list is towards the bottom of the SVG, shift it to the top of the next column
                if(yValue + sectionHeight > that.height * 0.98) {
                    yValue = interChrSpace;
                    xValue += columnSpace;
                }

                that.legend.append("text")
                    .attr("class", "list-head")
                    .attr("transform", "translate(" + xValue + ", " + yValue + ")")
                    .html("Chr " + e.chr);

                yValue += lineSpace;

                e.genes.forEach(function(f) {
                    that.legend.append("text")
                        .attr("class", "list-content")
                        .attr("transform", "translate(" + xValue + ", " + yValue + ")")
                        .html(function() {
                            if(f.content) {
                                return f.content;
                            }
                            return f.gene_symbol + " (gene)"
                        });

                    yValue += lineSpace;
                });
                
                e.qtls.forEach(function(f) {
                    that.legend.append("text")
                        .attr("class", "list-content")
                        .attr("transform", "translate(" + xValue + ", " + yValue + ")")
                        .html(f.qtl_symbol + " (QTL)");

                    yValue += lineSpace;
                });

                yValue += interChrSpace;
            })
        };

        /**
         * renders feature blocks that extend from the outer ring
         *
         * @param {Array} highlightedBlocks - object array with data to render the blocks
         */
        OuterPlot.prototype.drawHighlightedBlocks = function(highlightedBlocks) {
            let that = this;
            let innerEdge = that.radius.ticks;
            let outerEdge = innerEdge + 15;

            // clean up any previous feature blocks
            that.featureBlocks.selectAll("path").remove();

            // render the feature blocks
            that.featureBlocks.selectAll("path")
                .data(highlightedBlocks)
                .enter()
                .append("path")
                .attr("class", "highlighted-block")
                .attr("d", function(d) {
                    return SynUtils.getArcPath(innerEdge, outerEdge, that.genoData.genoCoords, d);
                })
                .attr("fill", function(d) {
                    return that.genoData.colorScheme[d.cytoBandType].color;
                });

        };

        /**
         * returns all blocks and indexes for the given chr as well as size data for the chr
         *
         * @param {string} selectedChr - selected chromosome
         * @return {Object} - data for all blocks in the selected chromosome
         */
        OuterPlot.prototype.getRefBlockBands = function(selectedChr) {
            selectedChr = SynUtils.checkAndResetChr(selectedChr);

            let selectedChrBlockBands = [];
            let selectedChrBand = null;
            let selectedIndexes = [];

            // make copies of these lists so the originals aren't altered
            let intervals = this.genoIntervals.slice();
            let blockBands = this.genoData.syntenicBlocks.slice();

            intervals.forEach(function(e) {
                if(e.chr === selectedChr) {
                    selectedChrBand = {chr: "ref" + e.chr, size: e.size};
                }
            });

            selectedChr = SynUtils.checkAndResetChr(selectedChr);

            blockBands.forEach(function(e, i) {
                e.chr = SynUtils.checkAndResetChr(e.chr);
                if(e.chr === selectedChr) {
                    selectedIndexes.push(i);
                    e.chr = "ref" + e.chr;
                    selectedChrBlockBands.push(e);
                }
            });

            return {chrBand: selectedChrBand, blockBands: selectedChrBlockBands, indexes: selectedIndexes};
        };

        /**
         * returns block that contains the element given the start and end positions
         *
         * @param {string} selectedChr - selected chromosome
         * @param {number} start - start position for feature
         * @param {number} end - end position for feature
         * @return {Object} selectedBlock - the block that contains the element's start and end
         */
        OuterPlot.prototype.getBlocks = function(selectedChr, start, end) {
            let selectedBlocks = [];
            let blockBands = this.genoData.syntenicBlocks.slice();

            let startFound = false;
            let endFound = false;
            for(let i = 0; i < blockBands.length; i++) {
                if(!endFound) {
                    let block = blockBands[i];
                    let blockAdded = false;
                    let blockEnd = block.startPos + block.size;
                    if (block.chr === selectedChr || block.chr === "ref" + selectedChr) {
                        if (!startFound) {
                            if (start >= block.startPos && start <= blockEnd) {
                                startFound = true;
                                selectedBlocks.push(Object.assign({}, block));
                                blockAdded = true;
                            }
                        }
                        if (startFound) {
                            if (end <= blockEnd) {
                                endFound = true;
                            }

                            if (!blockAdded) {
                                selectedBlocks.push(Object.assign({}, block));
                                blockAdded = true;
                            }
                        }
                    }
                }
            }

            return selectedBlocks;
        };

        /**
         * renders red indicators
         */
        OuterPlot.prototype.drawIndicators = function() {
            let that = this;
            let features = JaxSynteny.highlightedFeatures;

            // get the search type
            that.searchType = $(".view-blocks-btn").attr("class").split(" ")[2];

            // group features by the chromosome they're located in
            let featuresByChr = [];
            let legendData = [];

            features.gene.forEach(function(e) {
                let found = false;
                if(featuresByChr.length > 0) {
                    for (let j = 0; j < featuresByChr.length; j++) {
                        if (featuresByChr[j].chr === e.chr) {
                            featuresByChr[j].gene_symbols.push(e.gene_symbol);
                            legendData[j].genes.push(e);
                            found = true;
                        }
                    }
                }
                if (!found) {
                    featuresByChr.push({
                        chr: e.chr,
                        gene_symbols: [e.gene_symbol],
                        qtl_symbols: []
                    });
                    legendData.push({
                        chr: e.chr,
                        genes: [e],
                        qtls: []
                    });
                }
            });

            features.qtl.forEach(function(e) {
                let found = false;
                if(featuresByChr.length > 0) {
                    for (let j = 0; j < featuresByChr.length; j++) {
                        if (featuresByChr[j].chr === e.chr) {
                            featuresByChr[j].qtl_symbols.push(e.qtl_symbol);
                            legendData[j].qtls.push(e);
                            found = true;
                        }
                    }
                }
                if (!found) {
                    featuresByChr.push({
                        chr: e.chr,
                        gene_symbols: [],
                        qtl_symbols: [e.qtl_symbol]
                    });
                    legendData.push({
                        chr: e.chr,
                        genes: [],
                        qtls: [e]
                    });
                }
            });

            // compute the position for the indicators based on position of chr
            featuresByChr.forEach(function(e) {
                let chrInterval = that.genoData.intervalPairs.assocArr[e.chr];
                let chrMidPoint = chrInterval.size / 2.0;

                e.pos = that.genoData.genoCoords.genoPosToCartesian(that.radius.indicators, e.chr, chrMidPoint);
            });

            // clean up any previous indicators
            that.featureIndicators.selectAll("circle").remove();

            // render the indicators
            that.featureIndicators.selectAll("circle")
                .data(featuresByChr)
                .enter()
                .append("circle")
                .attr("cx", function(d) {
                    return d.pos.x;
                })
                .attr("cy", function(d) {
                    return d.pos.y
                })
                .attr("r", 10)
                .attr("fill", "red")
                .attr("id", function(d) {
                    return d.chr + "-indicator";
                })
                .attr("class", "feature-indicator")
                .on("mouseover", that.featureTip.show)
                .on("mousemove", function () { // tooltip follows mouse
                    return that.featureTip
                                .style("top", (d3.event.pageY - 10) + "px")
                                .style("left", (d3.event.pageX + 10) + "px");
                })
                .on("mouseout", that.featureTip.hide);

            that.generateLegend(legendData);
        };

        /**
         * clears featured blocks and indicators to return outer plot to its original state
         */
        OuterPlot.prototype.clean = function() {
            this.featureBlocks.selectAll("path").remove();
            this.featureIndicators.selectAll("circle").remove();
            d3.select("#genome-view-svg").select("#no-blocks");
            this.legend.selectAll("*").remove();
        };

        return OuterPlot;

    })();

    GenomeView.InnerPlot = (function() {
        /**
         * @constructor
         * @param {Object} comparisonData - data used to render the inner plot
         * @param {Object} svg - reference to parent svg element
         */
        function InnerPlot(comparisonData, svg) {
            // set up parameters for the inner plot
            this.genoData = comparisonData;
            let dimension = $(".custom-panel-body").width();
            this.width = dimension;
            this.height = dimension;
            this.arcHeight = 20;
            this.genoIntervals = SynUtils.getGenoIntervals(this.genoData.intervalPairs);

            let svgRadius = Math.min(this.width / 2, this.height / 2);
            let innerRadius = Math.round((2 / 5) * svgRadius + 30);
            this.radius = {
                svg: svgRadius,
                innerRing: innerRadius,
                innerLabels: (innerRadius + 40)
            };

            this.plot = svg.append("g")
                .attr("id", "inner-plot");
        }

        /**
         * renders inner plot
         */
        InnerPlot.prototype.render = function() {
            let that = this;

            that.innerRing = that.plot.append("g")
                .attr("id", "inner-ring")
                .attr("transform", "translate(" + that.radius.svg + ", " + that.radius.svg + ")");

            that.comparisonChrBands = that.innerRing.append("g")
                .attr("id", "inner-chr-bands");

            that.comparisonLabels = that.innerRing.append("g")
                .attr("id", "inner-labels");

            that.chords = that.innerRing.append("g")
                .attr("id", "chords");

            // render the arcs and labels with default intervals and genoCoords
            that.drawArcs(that.genoIntervals, that.genoData.genoCoords);
            that.drawLabels(that.genoIntervals, that.genoData.genoCoords);
        };

        /**
         * renders arcs for the inner ring
         *
         * @param {Array} arcs - object array with block data for arc rendering
         * @param {Object} genoCoords - functions and data needed for rendering
         */
        InnerPlot.prototype.drawArcs = function(arcs, genoCoords) {
            let that = this;
            let innerEdge = this.radius.innerRing;
            let outerEdge = innerEdge + that.arcHeight;

            // clean up all existing arcs
            that.comparisonChrBands.selectAll("path").remove();

            // render chr bands
            that.comparisonChrBands.selectAll("path")
                .data(arcs)
                .enter()
                .append("path")
                .attr("id", function(d) {
                    if(d.chr.length > 2) {
                        if(d.index) {
                            return d.chr + "-" + d.index;
                        }
                        return d.chr;
                    }
                    return "chr" + d.chr;
                })
                .attr("class", function(d) {
                    if (d.chr.length > 2 && d.index) {
                        return "inner ref-block-band";
                    }
                    return "inner inner-chr-band";
                })
                .attr("d", function(d) {
                    return SynUtils.getArcPath(innerEdge, outerEdge, genoCoords, d);
                })
                .attr("fill", function(d, i) {
                    if(d.cytoBandType || d.cytoBandType === 0) {
                        return that.genoData.colorScheme[d.cytoBandType].color
                    }
                    if(that.genoData.colorScheme[i]) {
                        return that.genoData.colorScheme[i].color;
                    }
                    return "none";
                });

        };

        /**
         * renders labels for the inner ring
         *
         * @param {Array} labels - object array with block data for label rendering
         * @param {Object} genoCoords - functions and data needed for rendering
         */
        InnerPlot.prototype.drawLabels = function(labels, genoCoords) {
            let that = this;
            let chrs = genoCoords.chrIntervals.keys;
            let textTransformations = [];

            chrs.forEach(function(chr, counter) {
                let chrInterval;
                let chrMidPoint;
                let labelPos;
                let radians;

                chrInterval = genoCoords.chrIntervals.assocArr[chr];
                chrMidPoint = chrInterval.size / 2.0;
                labelPos = genoCoords.genoPosToCartesian(that.radius.innerLabels, chr, chrMidPoint);
                radians = genoCoords.genoPosToRadians(chr, chrMidPoint);

                let txtTrans = "translate(" + labelPos.x + "," + labelPos.y +
                        ")rotate(" + (90 + SynUtils.radToDeg(radians)) + ")";

                if (counter > (chrs.length / 2 - 1)) {
                    txtTrans += "rotate(90)";
                } else {
                    txtTrans += "rotate(-90)";
                }
                textTransformations.push(txtTrans);
            });

            that.comparisonLabels.selectAll("text").remove();

            that.comparisonLabels.selectAll("text")
                .data(labels)
                .enter()
                .append("text")
                .attr("class", "outer outer-label")
                .attr("text-anchor", "middle")
                .attr("transform", function(d, i) {
                    return textTransformations[i];
                })
                .text(function(d) {
                    return d.chr;
                })
        };

        /**
         * renders chords
         *
         * @param {Array} chords - object array with chord data for chord rendering
         * @param {Object} genoCoords - functions and data needed for rendering
         */
        InnerPlot.prototype.drawChords = function(chords, genoCoords) {
            let that = this;

            // clean up any previous chords
            that.chords.selectAll("path").remove();

            // render chords
            that.chords.selectAll("path")
                .data(chords)
                .enter()
                .append("path")
                .attr("class", "chord")
                .attr("d", function(d) {
                    return SynUtils.getChordPath(that.radius.innerRing, genoCoords, d);
                })
                .attr("fill", function(d) {
                    return that.genoData.colorScheme[d.cytoBandType].color;
                })
                .attr("stroke", function(d) {
                    return that.genoData.colorScheme[d.cytoBandType].color;
                });
        };

        /**
         * returns the genoIntervals for the inner ring
         *
         * @return {Array} genoIntervals - array with interval data
         */
        InnerPlot.prototype.getGenoIntervals = function() {
            return this.genoIntervals;
        };

        /**
         * clears chords and resets arcs to return inner plot to its original state
         */
        InnerPlot.prototype.clean = function() {
            this.chords.selectAll("path").remove();
            this.drawArcs(this.genoIntervals, this.genoData.genoCoords);
            this.drawLabels(this.genoIntervals, this.genoData.genoCoords);
        };

        return InnerPlot;

    })();
})(GenomeView || (GenomeView={}));