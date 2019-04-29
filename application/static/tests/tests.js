////////////////////////////////////////////////////////////////
// Logger Module
////////////////////////////////////////////////////////////////
// Logger Module Setup
QUnit.module.skip("Logger", {
    beforeEach: function() {
        this.log = new Logger.Log();
    },
    afterEach: function() {
        delete this.log;
    }
});
// Start Logger Tests
QUnit.test("Log creation", function(assert) {

    assert.ok(this.log);
    assert.equal(this.log.getLog().length, 0);
});

QUnit.test("Write single message to log", function(assert) {
    this.log.logThis("test 1");
    assert.equal(this.log.getLog().length, 1);
    assert.equal(this.log.getLog()[0], "test 1");
    assert.notEqual(this.log.getLog()[0], "test 2");
});

QUnit.test("Write multiple messages to log", function(assert) {
    this.log.logThis("test 1");
    assert.equal(this.log.getLog().length, 1);
    this.log.logThis("test 2");
    assert.equal(this.log.getLog().length, 2);
    assert.equal(this.log.getLog()[0], "test 1");
    assert.equal(this.log.getLog()[1], "test 2");
});

QUnit.test("Default log state", function(assert) {
    assert.notOk(this.log.isLogOpen());
});

QUnit.test("Open an closed log", function(assert) {
    this.log.openLog();
    assert.ok(this.log.isLogOpen());
    this.log.closeLog();
});

QUnit.test("Open an open log", function(assert) {
    this.log.openLog();
    assert.ok(this.log.isLogOpen());
    this.log.openLog();
    assert.ok(this.log.isLogOpen());
    this.log.closeLog();
});

QUnit.test("Close an open log", function(assert) {
    this.log.openLog();
    assert.ok(this.log.isLogOpen());
    this.log.closeLog();
    assert.notOk(this.log.isLogOpen());
});

QUnit.test("Close a closed log", function(assert) {
    assert.notOk(this.log.isLogOpen());
    this.log.closeLog();
    assert.notOk(this.log.isLogOpen());
});


////////////////////////////////////////////////////////////////
// Species Module
////////////////////////////////////////////////////////////////
// Species Module Setup
QUnit.module.skip("Species", {
    beforeEach: function() {
        this.species = new Species.Species("9606_config.json");
    },
    afterEach: function(assert) {
        delete this.species;
        assert.notOk(this.species);
    }
});
// Start Species Tests
QUnit.test("Species creation", function(assert) {
    let species = this.species;
    assert.ok(species);
    assert.equal(species.getSpeciesId(), 9606);
    assert.equal(species.name, "Homo sapiens");
    assert.equal(species.source, "9606_config.json");

    let dataCat = species.dataCategories;
    assert.equal(dataCat.length, 3);
    assert.equal(dataCat[0].name, "gene");
    assert.equal(dataCat[0].value, "Gene Name");
    assert.equal(dataCat[0].search_example, "gene symbol (e.g. Brca)");
    assert.equal(dataCat[0].search_command, "GeneNameSearch");

    let exResrc = species.externalResources;
    assert.equal(exResrc.length, 1);
    assert.equal(exResrc[0].name, "MGI");

    let chrSizes = species.getChromosomeSizes();
    assert.equal(chrSizes.length, 24);
    assert.equal(chrSizes[0].chr, "1");
    assert.equal(chrSizes[0].size, 249250621);

});


////////////////////////////////////////////////////////////////
// SynUtils Module
////////////////////////////////////////////////////////////////
QUnit.module("SynUtils", function() {
    // Start SynUtils Tests
    QUnit.test("Utils module creation", function(assert) {
        assert.ok(SynUtils);
    });

    //=======================================================

    QUnit.test("Utils.calculateJitter - zero space and position", function(assert) {
        let jitter = SynUtils.calculateJitter(0, 0, 5);

        assert.notOk(jitter);
        assert.equal(jitter, 0);
    });

    QUnit.test("Utils.calculateJitter - zero space", function(assert) {
        let jitter = SynUtils.calculateJitter(0, 35, 5);

        assert.notOk(jitter);
        assert.equal(jitter, 0);
    });

    QUnit.test("Utils.calculateJitter - zero position", function(assert) {
        assert.ok(SynUtils.calculateJitter((60 / 13), 0, 5));
    });

    //=======================================================

    QUnit.test("Utils.parseReferenceInterval - no string", function(assert) {
        assert.notOk(SynUtils.parseReferenceInterval(null));
    });

    QUnit.test("Utils.parseReferenceInterval - empty string", function(assert) {
        assert.notOk(SynUtils.parseReferenceInterval(""));
    });

    QUnit.test("Utils.parseReferenceInterval - numeric chr", function(assert) {
        let interval = SynUtils.parseReferenceInterval("Chr1:0-1000000");

        assert.ok(interval);
        assert.equal(interval.chr, "1");
        assert.equal(interval.startPos, 0);
        assert.equal(interval.endPos, 1000000);
        assert.equal(interval.size, 1000000);
    });

    QUnit.test("Utils.parseReferenceInterval - alpha capital chr", function(assert) {
        let interval = SynUtils.parseReferenceInterval("ChrX:0-1000000");

        assert.ok(interval);
        assert.equal(interval.chr, "X");
        assert.equal(interval.startPos, 0);
        assert.equal(interval.endPos, 1000000);
        assert.equal(interval.size, 1000000);
    });

    QUnit.test("Utils.parseReferenceInterval - alpha lowercase chr", function(assert) {
        let interval = SynUtils.parseReferenceInterval("Chrx:0-1000000");

        assert.ok(interval);
        assert.equal(interval.chr, "X");
        assert.equal(interval.startPos, 0);
        assert.equal(interval.endPos, 1000000);
        assert.equal(interval.size, 1000000);
    });

    QUnit.test("Utils.parseReferenceInterval - lowercase 'chr'", function(assert) {
        let interval = SynUtils.parseReferenceInterval("chrX:0-1000000");

        assert.ok(interval);
        assert.equal(interval.chr, "X");
        assert.equal(interval.startPos, 0);
        assert.equal(interval.endPos, 1000000);
        assert.equal(interval.size, 1000000);
    });

    QUnit.test("Utils.parseReferenceInterval - no 'chr'", function(assert) {
        let interval = SynUtils.parseReferenceInterval("1:0-1000000");

        assert.ok(interval);
        assert.equal(interval.chr, "1");
        assert.equal(interval.startPos, 0);
        assert.equal(interval.endPos, 1000000);
        assert.equal(interval.size, 1000000);
    });

    QUnit.test("Utils.parseReferenceInterval - invalid chr", function(assert) {
        let interval = SynUtils.parseReferenceInterval("0:0-1000000");

        assert.ok(interval);
        assert.equal(interval.chr, "0");
        assert.equal(interval.startPos, 0);
        assert.equal(interval.endPos, 1000000);
        assert.equal(interval.size, 1000000);
    });

    QUnit.test("Utils.parseReferenceInterval - invalid interval", function(assert) {
        let interval = SynUtils.parseReferenceInterval("1:100-20");

        assert.ok(interval);
        assert.equal(interval.chr, "1");
        assert.equal(interval.startPos, 100);
        assert.equal(interval.endPos, 20);
        assert.equal(interval.size, -80);
    });

    QUnit.test("Utils.parseReferenceInterval - negative start", function(assert) {
        let interval = SynUtils.parseReferenceInterval("1:-4-100");

        assert.notOk(interval);
    });

    //=======================================================

    QUnit.test("Utils.fadeColor - valid 6-digit hex and opacity", function(assert) {
        assert.equal(SynUtils.fadeColor("#000000", 1), "rgba(0,0,0,1)");
        assert.equal(SynUtils.fadeColor("#000000", 0.3), "rgba(0,0,0,0.3)");
    });

    QUnit.test("Utils.fadeColor - valid 3-digit hex and opacity", function(assert) {
        assert.equal(SynUtils.fadeColor("#000", 1), "rgba(0,0,0,1)");
    });

    QUnit.test("Utils.fadeColor - throws on invalid 5-digit hex", function(assert) {
        // this assert checks that an error is thrown
        assert.throws(function() {
            SynUtils.fadeColor("#00000", 1)
        });

        // this assert checks that the error thrown matches the specified error
        assert.throws(function() {
            SynUtils.fadeColor("#00000", 1)
        }, new Error("Bad Hex"));
    });

    QUnit.test("Utils.fadeColor - throws on rgb(a) values", function(assert) {
        // this assert checks that an error is thrown
        assert.throws(function() {
            SynUtils.fadeColor("rgb(100, 240, 240)", 0.6);
        });

        assert.throws(function() {
            SynUtils.fadeColor("rgba(100, 240, 240, 0.5)", 0.6);
        });
    });

    //=======================================================

    QUnit.test("Utils.checkAndResetChr - no changes expected, single digit", function(assert) {
        assert.equal(SynUtils.checkAndResetChr("1"), "1");
    });

    QUnit.test("Utils.checkAndResetChr - no changes expected, double digits", function(assert) {
        assert.equal(SynUtils.checkAndResetChr("12"), "12");
    });

    QUnit.test("Utils.checkAndResetChr - no changes expected, string", function(assert) {
        assert.equal(SynUtils.checkAndResetChr("X"), "X");
    });

    QUnit.test("Utils.checkAndResetChr - strip 'ref', single digit", function(assert) {
        assert.equal(SynUtils.checkAndResetChr("ref1"), "1");
    });

    QUnit.test("Utils.checkAndResetChr - strip 'ref', double digits", function(assert) {
        assert.equal(SynUtils.checkAndResetChr("ref12"), "12");
    });

    QUnit.test("Utils.checkAndResetChr - strip 'ref', string", function(assert) {
        assert.equal(SynUtils.checkAndResetChr("refX"), "X");
    });

    QUnit.test("Utils.checkAndResetChr - strip 'chr0', single digit", function(assert) {
        assert.equal(SynUtils.checkAndResetChr("chr01"), "1");
    });

    QUnit.test("Utils.checkAndResetChr - strip 'chr', double digits", function(assert) {
        assert.equal(SynUtils.checkAndResetChr("chr12"), "12");
    });

    QUnit.test("Utils.checkAndResetChr - strip 'chr', string", function(assert) {
        assert.equal(SynUtils.checkAndResetChr("chrX"), "X");
    });
});