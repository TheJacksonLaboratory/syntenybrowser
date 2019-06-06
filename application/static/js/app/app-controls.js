"use strict";

/**
 * @file: app-controls.js
 * @fileOverview:
 * @created: 11/28/2017
 * @last modified: 11/29/2017
 * @author: georgi.kolishovski@jax.org, anna.lamoureux@jax.org
 */
 
 var AppControls;
 
(function(AppControls) {
    ///////////////////////////////////////////////////////////////////////////
    // class SidebarControlPanel
    // 
    ///////////////////////////////////////////////////////////////////////////
    let RightOverlayPanel = (function() {
        /**
         * constructor
         */
        function RightOverlayPanel() {
            let panel = $("#set-open");
            let blockview = JaxSynteny.dataManager._blockViewBrowser;

            /*
            The following several methods are click-based behaviors. The first three behaviors are only done if the
             block view has been initialized. Otherwise, the checkbox will still change, but the state of the boxes
              will just be taken into consideration when the block view renders
             */

            $("#bv-show-gene-symbols").on("click", function() {
                if(blockview) {
                    blockview.updateReferenceTrack();
                    blockview.updateComparisonTrack();
                }
            });

            $("#bv-show-anchors").on("click", function() {
                if(blockview) {
                    blockview.updateAnchors();
                }
            });

            $("#update-btn").on("click", function() {
                let msg = $("#ref-genome-interval-msg");
                msg.html("");

                let newInterval = SynUtils.parseReferenceInterval(JaxSynteny.dataManager.getReferenceInterval());
                let currInterval = blockview._referenceInterval;

                // if there is a interval present update the reference
                if($("#ref-genome-interval").val() === "") {
                    msg.html("Please enter a valid interval");
                    setTimeout(function() { msg.html(""); }, 10000);

                } else if(currInterval && currInterval.chr === newInterval.chr &&
                          currInterval.startPos === newInterval.startPos && currInterval.endPos === newInterval.endPos) {
                    msg.html("This interval is already viewable in the block view");
                    setTimeout(function() { msg.html(""); }, 10000);
                } else {
                    JaxSynteny.dataManager.loadBlockViewBrowser();
                }
            });

            $("#bv-true-orientation").on("click", function() {
                if(blockview) {
                    if ($("#bv-true-orientation").is(":checked")) {
                        blockview._anchorPoints = 'trueAnchorPoints'
                    } else {
                        blockview._anchorPoints = 'matchAnchorPoints'
                    }

                    blockview.changeOrientation();
                }
            });

            // click anywhere within the collapsed panel will expand it
            $("#collapsed-panel").on("click", function() {
                panel.removeClass("closed");
                panel.animate({right: "275px"}, 500);
            });

            // click on the "X" icon will collapse the panel
            $("#collapse-panel-icon").on("click", function() {
                panel.addClass("closed");
                panel.animate({right: "0px"}, 500);
            });

            // click anywhere outside the panel will collapse it 
            // (if it has been opened before that)
            $(".my-custom-container").on("click", function() {
                let classList = panel.attr("class").split(" ");
                if(classList.length === 1) {
                    panel.addClass("closed");
                    panel.animate({right: "0px"}, 500);
                }
            });

            // reference and comparison genome selectors operation
            let refGenomeSelect = $("#ref-genome-select");
            let compGenomeSelect = $("#comp-genome-select");

            disableSelectOption(compGenomeSelect, refGenomeSelect.val());

            refGenomeSelect.on("change", function() {
                let val = $(this).val();
                let compOptions = getSelectOptions(compGenomeSelect);
                let refOptions = getSelectOptions($(this));

                if(val === refOptions.val()) {
                    enableOptions(compOptions);
                    compGenomeSelect.val(compOptions.eq(1).val());
                    disableSelectOption(compGenomeSelect, val);
                }

                // otherwise, set the comparison to the first option
                // disable the option that matches reference selected
                else {
                    enableOptions(compOptions);
                    compGenomeSelect.val(compOptions.val());
                    disableSelectOption(compGenomeSelect, val);
                }

                // load the genome view after change
                JaxSynteny.setup();
            });
        }

        /**
         * disables the option with its value matched
         * @param {Object} elm - DOM (Document OBject Model) element - <select> in most cases
         * @param {string} val - option's value
         */
        function disableSelectOption(elm, val) {
            elm.children("option[value*=" + val + "]")
                .prop("disabled", true);
        }

        /**
		*
		*
		*/
        function enableOptions(options) {
            options.prop("disabled", false);
        }


        function getSelectOptions(elm) {
            return elm.children("option");
        }

        return RightOverlayPanel;
    })();
    AppControls.RightOverlayPanel = RightOverlayPanel;

})(AppControls || (AppControls={}));