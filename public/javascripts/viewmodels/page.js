/* global ko */
function MainViewmodel() {
    var audioContext;

    var sensitivityCurve = ko.observableArray([
        {frequency: 0, sensitivity: 0},
        {frequency: 50, sensitivity: 970},
        {frequency: 220, sensitivity: 995},
        {frequency: 440, sensitivity: 998},
        {frequency: 1000, sensitivity: 999},
        {frequency: 1500, sensitivity: 999},
        {frequency: 2000, sensitivity: 999},
        {frequency: 3000, sensitivity: 999},
        {frequency: 4000, sensitivity: 999},
        {frequency: 5000, sensitivity: 999},
        {frequency: 6000, sensitivity: 999},
        {frequency: 7000, sensitivity: 999},
        {frequency: 8000, sensitivity: 999},
        {frequency: 9000, sensitivity: 999},
        {frequency: 10000, sensitivity: 999},
        {frequency: 12000, sensitivity: 999},
        {frequency: 14000, sensitivity: 999},
        {frequency: 16000, sensitivity: 999},
        {frequency: 19500, sensitivity: 999},
        {frequency: 20000, sensitivity: 0}
    ]).extend({ rateLimit: 50 });

    var model = {
        coarse: ko.observable(0),
        fine: ko.observable(0),
        volume: ko.observable(50),
        play: ko.observable(false),
        playPause: playPause,
        beep: beep,
        loop: loop,
        clear: clear,
        saveStorage: saveStorage,
        saveName: ko.observable(new Date().toLocaleString()),
        loadName: ko.observable(),
        notSupported: ko.observable(false),
        interval: ko.observable(false),
        mark1: mark1,
        mark2: mark2,
        mark3: mark3,
        mark4: mark4,
        saves: ko.observableArray([]),
        loadStorage: loadStorage,
        deleteStorage: deleteStorage,
        channels: [{ name: 'left', value: -1}, {name: 'right', value: 1}],
        currentChannel: ko.observable(-1),
        reference: playReference,
        quieter: quieter,
        louder: louder,
        volumeUp: volumeUp,
        volumeDown: volumeDown
    }

    function adjust(amount) {
        if (_.some(sensitivityCurve(), function (item) {
            return (item.sensitivity * amount) > 1000;
        })) {
            // Max sensitivity
            console.log('too sensitive');
            return;
        }

        if (_.some(sensitivityCurve(), function (item) {
            return (item.sensitivity * amount) < 0;
        })) {
            // Min sensitivity
            return;
        }

        var newVolumes = _.map(sensitivityCurve(), function (item) {
            return {frequency: item.frequency, sensitivity: item.sensitivity *= amount};
        });

        sensitivityCurve.removeAll();
        _.each(newVolumes, function (item) {
            sensitivityCurve.push(item);
        });
    }

    function quieter() {
        adjust(1.001);
    }

    function louder() {
        adjust(0.999);
    }

    function volumeUp() {
        model.volume(model.volume() * 1.1);
    }

    function volumeDown() {
        console.log(model.volume());
        model.volume(model.volume() * 0.9);
        console.log(model.volume());
    }

    model.loadName.subscribe(function () {
        model.saveName(model.loadName());
    });

    for (var i = 0; i < window.localStorage.length; i += 1) {
        model.saves.push(window.localStorage.key(i));
    }

    var addEvent = (function () {
    if (document.addEventListener) {
        return function (el, type, fn) {
        if (el && el.nodeName || el === window) {
            el.addEventListener(type, fn, false);
        } else if (el && el.length) {
            for (var i = 0; i < el.length; i++) {
            addEvent(el[i], type, fn);
            }
        }
        };
    } else {
        return function (el, type, fn) {
        if (el && el.nodeName || el === window) {
            el.attachEvent('on' + type, function () { return fn.call(el, window.event); });
        } else if (el && el.length) {
            for (var i = 0; i < el.length; i++) {
            addEvent(el[i], type, fn);
            }
        }
        };
    }
    })();

    function processStorageEvent(event) {
        if (event.newValue) {
            if (!_.find(model.saves(), function (item) {
                return item === event.key;
            })) {
                model.saves.push(event.key);
                model.loadName(event.key);
            }
        } else {
            model.saves.remove(event.key);
        }
    }

    window.addEventListener('storage', processStorageEvent);

    var marks = [0,0,0,0];

    var lineOptions = {
        // ID of the element in which to draw the chart.
        element: 'frequencyResponse',
        // Chart data records -- each entry in this array corresponds to a point on
        // the chart.
        data: sensitivityCurve(),
        // The name of the data record attribute that contains x-values.
        xkey: 'frequency',
        // A list of names of data record attributes that contain y-values.
        ykeys: ['sensitivity'],
        // Labels for the ykeys -- will be displayed when you hover over the
        // chart.
        labels: ['sensitivity'],
        events: [0],
        eventLineColors: ['#1454ab', '#a4a4a4', '#a4a4a4', '#a4a4a4', '#a4a4a4', '#a4a4a4', '#a4a4a4', '#a4a4a4', '#a4a4a4'],
        smooth: false,
        xLabelFormat: function (x) { return x.getTime() },
        hoverCallback: function (index, options, content, row) {

            var text = "<div class='morris-hover-row-label'>" + row.frequency + "</div><div class='morris-hover-point' style='color: #0b62a4'>sensitivity: " + row.sensitivity.toFixed(2) + "</div>";

            return text;
        }
    }

    var sensitivityGraph = Morris.Line(lineOptions);

    sensitivityGraph.on('click', function (index, data, x, y) {
        if (data.frequency > 0) {
            model.coarse(data.frequency);
            model.fine(0);
            model.volume(1000 - data.sensitivity);
            if (!model.play()) {
                beep();
            }
        }
    });

    function saveStorage() {
        var key = model.saveName();
        var value = JSON.stringify(
            {
                sensitivityCurve: sensitivityCurve(),
                marks: marks.slice()
            });

        window.localStorage.setItem(key, value);

        processStorageEvent({key: key, newValue: value})
    }

    function loadStorage() {
        var newmodel = JSON.parse(window.localStorage.getItem(model.loadName()));

        if (!newmodel || !newmodel.marks || !newmodel.sensitivityCurve || newmodel.sensitivityCurve.length < 2) {

            console.log('Invalid model', newmodel);
            return;
        }

        marks = newmodel.marks.slice();
        sensitivityCurve.removeAll();
        _.each(newmodel.sensitivityCurve, function (item) {
            sensitivityCurve.push(item);
        });

        redrawMarks();
    }

    function deleteStorage() {
        window.localStorage.removeItem(model.saveName());
        processStorageEvent({key: model.saveName(), newValue: null});
    }

    try {
        // Fix up for prefixing
        window.AudioContext = window.AudioContext||window.webkitAudioContext;
        audioContext = new AudioContext();

        var oscillator = audioContext.createOscillator();
        var panNode = audioContext.createStereoPanner();
        var gainNode = audioContext.createGain();

        panNode.pan.value = -1;
        gainNode.gain.value = 0;

        oscillator.connect(panNode);
        panNode.connect(gainNode);
        gainNode.connect(audioContext.destination);

        oscillator.start();

        var refoscillator = audioContext.createOscillator();
        var refpanNode = audioContext.createStereoPanner();
        var refgainNode = audioContext.createGain();


        refpanNode.pan.value = 0;
        refgainNode.gain.value = 0;

        refoscillator.connect(refpanNode);
        refpanNode.connect(refgainNode);
        refgainNode.connect(audioContext.destination);

        refoscillator.start();
    }
    catch(e) {
        model.notSupported(true);
    }

    function playReference() {
        refgainNode.gain.value = 1;
        setTimeout(function() {
            refgainNode.gain.value = 0;
        }, 1000);
    }

    var finalFrequency = ko.pureComputed(function () {
        var calculated = parseInt(model.coarse()) + parseInt(model.fine());
        calculated = Math.min(calculated, 20000);
        calculated = Math.max(calculated, 50);
        return calculated;
    });

    var finalVolume = ko.pureComputed(function () {
        var volume = parseFloat(interpolatedVolume()) * (model.play() ? 0.001 : 0) * (model.interval() ? intervalSwitch() ? 1 : 0 : 1);
        return volume;
    });

    var intervalSwitch = ko.observable(false);
    setInterval(function () {
        intervalSwitch(!intervalSwitch());
    }, 250);

    sensitivityCurve.subscribe(function () {
        sensitivityGraph.setData(sensitivityCurve());
    });

    var interpolatedVolume = ko.pureComputed(function () {
        var frequency = finalFrequency();

        var sorted = _.sortBy(sensitivityCurve(), function (item) { return item.frequency });
        var lowerBound = _.findLast(sorted, function (item) { return item.frequency <= frequency; });
        var upperBound = _.find(sorted, function (item) { return item.frequency >= frequency; });

        var currentSensitivity = 0;
        if (lowerBound.frequency == upperBound.frequency) {
            currentSensitivity = lowerBound.sensitivity;
        } else {
            currentSensitivity = lowerBound.sensitivity + (( upperBound.sensitivity - lowerBound.sensitivity) * ( (frequency - lowerBound.frequency) / (upperBound.frequency - lowerBound.frequency)))
        }

        return 1000 - currentSensitivity;
    });

    interpolatedVolume.subscribe(function () {
        model.volume(interpolatedVolume());
    });

    finalFrequency.subscribe(function () {
        oscillator.frequency.value = finalFrequency();
        redrawMarks();
    });

    function redrawMarks() {
        lineOptions.events[0] = finalFrequency();
        for (var i = 0; i < 4; i += 1) {
            lineOptions.events[i + 1] = marks[i];
        }
        sensitivityGraph.events = lineOptions.events;
        sensitivityGraph.redraw();
    }

    model.volume.subscribe(function () {
        var volume = interpolatedVolume();
        if (model.volume() !== volume) {
            mark();
        }
    });

    finalVolume.subscribe(function () {
        gainNode.gain.value = finalVolume();
    })

    model.currentChannel.subscribe(function () {
        panNode.pan.value = model.currentChannel();
    });

    model.finalFrequency = finalFrequency;

    function playPause() {
        model.play(!model.play());
    }

    function beep(next) {
        model.play(true);
        setTimeout(function () {
            model.play(false);
            if (typeof(next) === 'function') { next(); }
        }, 1000);
    }

    function clear() {
        if (finalFrequency() > 0 && finalFrequency() < 20000) {
            sensitivityCurve.remove(function (item) {
                return item.frequency === finalFrequency();
            });
        }
    }

    function mark() {
        sensitivityCurve.remove(function (item) {
            return item.frequency === finalFrequency();
        });

        sensitivityCurve.push({
            frequency: finalFrequency(),
            sensitivity: 1000 - model.volume()
        });
    }

    var looping = false;
    function loop() {
        looping = !looping;

        if (!looping) {
            return;
        } else {
            playLoop();
        }
    }

    var currentLoopMark = 0;
    function playLoop() {
        currentLoopMark = 0;

        var wasPlaying = model.play();
        var original = finalFrequency();

        function restore() {
            model.coarse(original);
            model.play(wasPlaying);
        }

        function doBeep(index, next) {
            if (marks[index] != 0) {
                model.coarse(marks[index]);
                beep(next);
            } else {
                setTimeout(next, 10);
            }
        }

        function nextMark() {
            var nextLoopMark = Math.floor(Math.random() * 4);
            if (nextLoopMark === currentLoopMark) {
                nextLoopMark += 1;
                nextLoopMark %= 4;
            }

            currentLoopMark = nextLoopMark;

            if (looping) {
                doBeep(currentLoopMark, nextMark);
            } else {
                restore();
            }
        }

        doBeep(currentLoopMark, nextMark);
    }

    function storeMark(index, frequency) {
        var setMark = true;

        for (var i = 0; i < 4; i += 1) {
            if (marks[i] === frequency) {
                marks[i] = 0;

                if (i === index) {
                    setMark = false;
                }
            }
        }

        if (setMark) {
            marks[index] = frequency;
        }

        redrawMarks();
    }

    function mark1() {
        storeMark(0, finalFrequency());
    }

    function mark2() {
        storeMark(1, finalFrequency());
    }

    function mark3() {
        storeMark(2, finalFrequency());
    }

    function mark4() {
        storeMark(3, finalFrequency());
    }

    setTimeout(function () {
        model.coarse(440);
    }, 0);

    return model;
}
