/*
done once
keytool -genkey -v -keystore bestcolors.keystore -alias bestcolors -keyalg RSA -keysize 2048 -validity 10000

e:
cd E:\Dropbox\Projects\MobileBestColors

cordova run browser
cordova run android


Build
try 
cordova build android --release -- --keystore="my-release-key.keystore" --alias peterG

if that fails...
cordova build android --release -- --keystore="my-release-key.keystore" --alias peterG

publish this...
--> E:\Dropbox\Projects\MobileBestColors\platforms\android\app\build\outputs\apk\release\app-release.apk

not needed...
jarsigner.exe -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore E:\Dropbox\Projects\MobileBestColors\bestcolors.keystore E:\Dropbox\Projects\MobileBestColors\platforms\android\app\build\outputs\apk\release\app-release.apk bestcolors

*/

var BCApp = {
    sku: "droid10",
    rootServer: "http://alleyeonhue.web806.discountasp.net/bc/bestcolors.js",
    serverPrefix: "http://bestcolors-0922cb23.3f4e798c.svc.dockerapp.io:80/",       // Service is long lived...
    mailTo: "pgaston@alum.mit.edu",

    firsttime: true,
    dataUrl: null,
    fileUrl: null,
    storage: window.localStorage,
    xhr: null,      // only one outstanding at a time
    serverError: null,

    jPalPayload: null,
    jImagePayload: null,
    jPersist: null,
    jFirstTime: { 'firstVisit': null, 'lastVisit': null, 'visits': 0, devid: null },

       // Application Constructor
    DOMinitialize: function() {
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function() {
        console.log("onDeviceReady");
        $(document).on('pause', BCApp.fOnPause);                // not used
        $(document).on('resume', BCApp.fOnResume);
        $(document).on('pagebeforeshow', "#pgHome", homePage.initialize);
        $(document).on('pagebeforeshow', "#pgViewPalette", viewPalette.initialize);
        $(document).on('pagebeforeshow', "#pgTakeSelfie", takeSelfiePage.initialize);
        $(document).on('pagebeforehide', "#pgTakeSelfie", takeSelfiePage.leavePage);
        $(document).on('pagebeforeshow', "#pgTakeImage", takeImagePage.initialize);
        $(document).on('pagebeforehide', "#pgTakeImage", takeImagePage.leavePage);
        $(document).on('pagebeforeshow', "#pgSubmitSelfie", submitSelfie.initialize);
        $(document).on('pagebeforehide', "#pgSubmitSelfie", submitSelfie.leavePage);
        $(document).on('pagebeforeshow', "#pgValidateResults", validateResults.initialize);
        $(document).on('pagebeforeshow', "#pgViewImageResults", viewImageResults.initialize);
        $(document).on('pagebeforeshow', "#pgBadResults", badResults.initialize);
        $(document).on('pagebeforeshow', "#pgBadImageResults", badImageResults.initialize);

        BCApp.initialize();
        // this.receivedEvent('deviceready');
    },

/*
    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    },
*/

    fireEvent: function (appEvent, appValue) {      // event NOT triggered from DOM
        var event = jQuery.Event(appEvent);
        event.val = appValue;
        $(window).trigger(event);
    },

    ping: function () {
        console.log("Calling Ping");
        $.ajax({
            type: "GET",
            url: BCApp.serverPrefix + "ping",
            contentType: 'application/json',
            timeout: 3000,      // pretty quick
            success: function (jData) {
                console.log("gnip - " + jData.msg);
            },
            error: function (req, status, errThrown) {
                console.log("hard error");
                BCApp.serverError = "Server not responding";
                toast("Server not responding - may be spinning up...");
            }
        });
        console.log('ping');
    },

    initialize: function () {           // Called when DOM is ready, first time only
        console.log("BCApp initialize");

        /*
        // DEBUG - force reset to first time
        BCApp.jPalPayload = null;
        BCApp.jPersist = null;
        BCApp.doPersist();
        */
        
        
        BCApp.getPersist();

        if (BCApp.jPersist === null) {
           // toast("FIRST");

            // first time!
            console.log("first time!");
            BCApp.jPersist = BCApp.jFirstTime;
            BCApp.jPersist.firstVisit = new Date;
            BCApp.jPersist.lastVisit = new Date;
            BCApp.jPersist.devid = jsguid();
            BCApp.jPersist.visits = 1;
            BCApp.jPalPayload = null;
            BCApp.doPersist();
        } else {
        //    toast("NEXT: " + BCApp.jPersist.visits);
            BCApp.jPersist.lastVisit = new Date;
            BCApp.jPersist.visits++;
            BCApp.doPersist();
            if (BCApp.jPalPayload !== null) {
                $("body").pagecontainer("change", "#pgViewPalette", {}); // change page
                console.log("transition immediately to view palette");
            }
        }

        $('#numVisits').text("Your visit #" + BCApp.jPersist.visits);
    //    toast("visit: " + BCApp.jPersist.visits);

        // Get the location of our docker
        $.ajax({
            type: "GET",
            url: BCApp.rootServer,
            dataType: "text",       //        dataType: "xml",
            timeout: 5000,
            success: function (jText) {
                //toast("SUCCESS!!!");
                jData = JSON.parse(jText);
                bGood = jData.good;
                if (jData.good) {
                    console.log("BCApp.serverPrefix was "+BCApp.serverPrefix)
                    BCApp.serverPrefix = jData.server;
                    BCApp.setServerMsg(jData.message);
                    console.log("BCApp.serverPrefix now "+BCApp.serverPrefix)
                //    toast("found root");
                } else {
                    // can't reach root - try with last we knew...
                //    BCApp.setServerMsg("Core server not active, please try again later...");
                }
                //           console.log("success - read from web - size:" + data.length);


        //        BCApp.serverPrefix = "http://localhost:5000/";      // local debug
                console.log("server at " + BCApp.serverPrefix);
                BCApp.ping();       // see if server is up
            },
            error: function (req, status, errThrown) {
            //    BCApp.setServerMsg("Core server unreachable, please try again later...");
                //toast("ERROR");
                BCApp.ping();       // see if server is up anyways
            }
        });

    },
    setServerMsg: function (msg) {
        $('#txtHomeMsgFromServer').text(msg);
        $('#txtViewMsgFromServer').text(msg);
    },

    storageSuccess: function (obj) {
        console.log("storageSuccess:"+obj.name);
    },
    storageError: function (error) {
        console.log("ERROR: storageError:" +error.code);
        if (error.exception !== "") console.log(error.exception);
    },
    jDoPersist: function (key, obj) {
//        if (true) {
            aJ = JSON.stringify(obj);
            BCApp.storage[key] = aJ;
//        } else
//           NativeStorage.setItem(key, obj, BCApp.storageSuccess, BCApp.storageError);
    },
    doPersist: function () {
        BCApp.jDoPersist("palette", BCApp.jPalPayload);
        BCApp.jDoPersist("bestcolors", BCApp.jPersist);
    },
    jGetPersist: function (key) {
//        if (true) {
            aJ = BCApp.storage[key];
            obj = JSON.parse(aJ);
//        } else {
//            obj = NativeStorage.getItem(key, BCApp.storageSuccess, BCApp.storageError);
//        }
        return obj;
    },
    getPersist: function () {
        BCApp.jPalPayload = BCApp.jGetPersist("palette");
        BCApp.jPersist = BCApp.jGetPersist("bestcolors");
    },
    beforeShow: function () {       // all DOM elements available...

    },
    fOnPause: function () {
        console.log("fOnPause");
    },
    fOnResume: function () {
        console.log("fOnResume");
    }
};

/*******************
/* The Views
/*******************/

var homePage = {
    initialize: function () {
        console.log("homePage initialize");

        if (BCApp.jPalPayload !== null) {
            $("body").pagecontainer("change", "#pgViewPalette", {}); // change page
            console.log("transition immediately to view palette");
        }
    }
};


// for camera.cleanup - iOS only apparently
function cleanupSuccess() {
    console.log("cleanup success");
}
function cleanupFailure(errMsg) {           // hmmm...
    console.log("cleanup failure - "+errMsg);
}
function cameraFailure(errMsg) {        // general failure - though may be cancel button...
    console.log("Camera error - "+errMsg);
    toast("Camera error - "+errMsg);
}

var takeSelfiePage = {
    showGrab: function () {
        $('#dvFileTake').show();
        $('#dvFileSpecd').hide();
    },


    // Trying the fileUri way...
    cameraSuccess: function (fileUri) {
        console.log("Image capture success");
        BCApp.fileUrl = fileUri;
        $('#imgUploadedImg').attr("src", fileUri);
        $('#dvFileTake').hide();
        $('#dvFileSpecd').show();


        window.resolveLocalFileSystemURL(imgUri, function success(fileEntry) {

            // Do something with the FileEntry object, like write to it, upload it, etc.
            // writeFile(fileEntry, imgUri);
            console.log("got file: " + fileEntry.fullPath);
            // displayFileData(fileEntry.nativeURL, "Native URL");

            }, function () {
              // If don't get the FileEntry (which may happen when testing
              // on some emulators), copy to a new FileEntry.
                createNewFileEntry(imgUri);
                console.log("got me ");
            });

        },

/*
    cameraSuccess: function (dataUrl) {
        console.log("Image capture success");
        BCApp.dataUrl = "data:image/png;base64," + dataUrl;
        $('#imgUploadedImg').attr("src", BCApp.dataUrl);
        $('#dvFileTake').hide();
        $('#dvFileSpecd').show();
    },
*/
    getSelfie: function (srcType) {
        console.log("getSelfie");
        navigator.camera.getPicture(
            takeSelfiePage.cameraSuccess,
            cameraFailure,
            {
                quality: 100,   // want pixels in the eye
            //    destinationType: Camera.DestinationType.DATA_URL,
            //    destinationType: Camera.DestinationType.FILE_URI,
                destinationType: Camera.DestinationType.NATIVE_URI,
                sourceType: srcType,
                encodingType: Camera.EncodingType.PNG,
                correctOrientation: true,  //Corrects Android orientation quirks
                mediaType: Camera.MediaType.PICTURE,
                cameraDirection: Camera.Direction.FRONT     // now working?
            });
        console.log("after getPicture");
    },

    initialize: function () {
        console.log("takeSelfiePage initialize: " + BCApp.serverPrefix);
        takeSelfiePage.showGrab();

        $("#btnTakeSelfieSnap").on('click', function (event) {
            event.preventDefault();
            console.log("btnTakeSelfieSnap");
            takeSelfiePage.getSelfie(Camera.PictureSourceType.CAMERA);
        });

        $("#btnUploadSelfieSnap").on('click', function (event) {
            event.preventDefault();
            console.log("btnTakeSelfieSnap");
            takeSelfiePage.getSelfie(Camera.PictureSourceType.PHOTOLIBRARY);
        });

        $("#btnReTakeSelfie").on('click', function (event) {
            event.preventDefault();
            console.log("btnReTakeSelfie");
            takeSelfiePage.showGrab();
        });
    },

    leavePage: function () {
        $("#btnTakeSelfieSnap").off('click');
        $("#btnUploadSelfieSnap").off('click');
        $("#btnReTakeSelfie").off('click');

        navigator.camera.cleanup(cleanupSuccess, cleanupFailure);
    }
};

var submitSelfie = {
    // to play around w/ File and File Transfer...
    // https://stackoverflow.com/questions/38688006/why-doesnt-formdata-append-file-from-fileentry-upload-correctly
    // https://stackoverflow.com/questions/28843883/append-image-file-to-form-data-cordova-angular
    // https://stackoverflow.com/questions/41702295/convert-file-url-to-path-and-send-to-file-reader-in-javascript

    winft: function(r) {
        console.log("Code = " + r.responseCode);
        console.log("Response = " + r.response);
        console.log("Sent = " + r.bytesSent);
    },

    failft: function(error) {
        alert("An error has occurred: Code = " + error.code);
        console.log("upload error source " + error.source);
        console.log("upload error target " + error.target);
    },



    doTheSubmit: function () {






/*
        var formData = new FormData();
        formData.append('image', blobifyImage(BCApp.dataUrl, "image/png"));
        formData.append('sku', BCApp.sku);

        BCApp.xhr = $.ajax({
            method: 'POST',
            url: BCApp.serverPrefix + "selfie2Palette",
            data: formData,
            timeout: 45000,     // long - server proc is ~5-10 seconds on fast machine - provide extra
            contentType: false,
            processData: false,
            success: function (jData) {
                BCApp.xhr = null;
                console.log("success - read from web:"+jData.good);
                if (jData.good) {
                    BCApp.jPalPayload = jData;
                    $("body").pagecontainer("change", "#pgValidateResults", {}); // change page
                } else {
                    console.log("Selfie2Palette failure - " + jData.error);
                    if (jData !== null)
                        BCApp.serverError = jData.error;
                    else
                        BCApp.serverError = "Unknown server problem - sorry";

                    BCApp.xhr = null;
                //    toast(BCApp.serverError);
                    $("body").pagecontainer("change", "#pgBadResults", {}); // change page
                }
            },
            error: function (req, status, errThrown) {
                console.log("Selfie2Palette hard error - " + status);
                BCApp.xhr = null;
                BCApp.serverError = "Server error - " + status;
                $("body").pagecontainer("change", "#pgBadResults", {}); // change page
            }
        });
*/
        console.log("Selfie2Palette");
    },

    initialize: function () {
        console.log("submitSelfie initialize: " + BCApp.serverPrefix);
/*
        // debugging...
        BCApp.jPalPayload = jGood;
        $("body").pagecontainer("change", "#pgValidateResults", {}); // change page
        return;
*/
        // try the built-in approach
        $('#imgSnapshot').attr("src", BCApp.dataUrl);
        loading(true);  // show spinner
        BCApp.serverError = null;

        // short delay to let UI catch up...
        window.setTimeout(submitSelfie.doTheSubmit, 10);
    },
    leavePage: function() {
        console.log("submitSelfie leavePage");
        BCApp.fileUrl = null;
        BCApp.dataUrl = null;
        
        if (BCApp.xhr !== null) {
            console.log("cancelling ajax request");
            xhr.abort();
            BCApp.xhr = null;
        }

        loading(false);  // hide spinner
    }
};



var takeImagePage = {
    showGrab: function () {
        $("#btnImageFileCamera").val("");    // clear
        $("#btnImageFileUpload").val("");    // clear
        $('#dvImageFileTake').show();
        $('#dvImageFileSpecd').hide();
        loading(false);  // hide spinner
    },

    doTheSubmit: function () {
        var formData = new FormData();
        formData.append('image', blobifyImage(BCApp.dataUrl, "image/png"));
        formData.append('palLookup', blobifyImage(BCApp.jPalPayload.palLookup, "image/png"));
        formData.append('palList', BCApp.jPalPayload.palList);
        formData.append('palId', BCApp.jPalPayload.palId);
        formData.append('sku', BCApp.sku);

        BCApp.xhr = $.ajax({
            method: 'POST',
            url: BCApp.serverPrefix + "evalImage",
            data: formData,
            timeout: 30000,
            contentType: false,
            processData: false,
            success: function (jData) {
                BCApp.xhr = null;
                loading(false);  // hide spinner
                console.log("good: " + jData.good);
                if (jData.good) {
                    console.log("evalImage success");
                    BCApp.jImagePayload = jData;
                    $("body").pagecontainer("change", "#pgViewImageResults", {}); // change page
                } else {
                    console.log("evalImage failure - " + jData.error);
                    console.log("badResults initialize");
                    if (jData !== null)
                        BCApp.serverError = jData.error;
                    else
                        BCApp.serverError = "Unknown server problem - sorry";

                    BCApp.xhr = null;
                    toast(BCApp.serverError);
                    takeImagePage.showGrab();
                }
            },
            error: function (req, status, errThrown) {
                console.log("evalImage hard error - " + status);
                loading(false);  // hide spinner
                BCApp.xhr = null;
                BCApp.serverError = "Server error - " + status;
                $("body").pagecontainer("change", "#pgBadImageResults", {}); // change page
            }
        });
    },

    justBack: function () {
        $('#imgImageUploadedImg').attr("src", BCApp.dataUrl);
        $('#dvImageFileTake').hide();
        $('#dvImageFileSpecd').show();
        loading(true);  // show spinner
        window.setTimeout(takeImagePage.doTheSubmit, 10);   // give time for UI to show...
    },

    cameraSuccess: function (dataUrl) {
        console.log("Image capture success");
        BCApp.dataUrl = "data:image/png;base64," + dataUrl;
        window.setTimeout(takeImagePage.justBack, 10);   // give time for UI to show...

        /*
                // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
                BCApp.jImagePayload = jFakeImage;
                $("body").pagecontainer("change", "#pgViewImageResults", {}); // change page
                return;
                // XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
        */
    },

    getImage: function (srcType) {
        console.log("getImage");
        BCApp.dataUrl = null;
        navigator.camera.getPicture(
            takeImagePage.cameraSuccess,
            cameraFailure,
            {
                quality: 50,
                destinationType: Camera.DestinationType.DATA_URL,
                targetHeight: 400,      // not sure what rules here...
                targetWidth: 200,
                sourceType: srcType,
                encodingType: Camera.EncodingType.PNG,
                correctOrientation: true,  //Corrects Android orientation quirks
                mediaType: Camera.MediaType.PICTURE,
                cameraDirection: Camera.Direction.BACK
            });
        console.log("after getPicture");
    },

    initialize: function () {
        console.log("takeImagePage initialize");
        takeImagePage.showGrab();
        BCApp.dataUrl = null;

        $("#btnTakeImageSnap").on('click', function (event) {
            event.preventDefault();
            console.log("btnTakeSelfieSnap");
            takeImagePage.getImage(Camera.PictureSourceType.CAMERA);
        });


        $("#btnUploadImageSnap").on('click', function (event) {
            event.preventDefault();
            console.log("btnTakeSelfieSnap");
            takeImagePage.getImage(Camera.PictureSourceType.PHOTOLIBRARY);
        });
        /*
        $("#btnTakeImageSnap").on('click', function (event) {
            event.preventDefault();
            console.log("btnTakeImageSnap");
            navigator.camera.getPicture(
                function (fileUri) {
                    console.log("Camera success");
                    takeImagePage.showImage(fileUri)
                },
                function (errStr) {
                    console.error("Camera error: " + errStr);
                    toast("Camera error - " + errMsg);
                },
                {
                    quality: 20,
                    destinationType: Camera.DestinationType.FILE_URI,
                    sourceType: Camera.PictureSourceType.CAMERA,
                    encodingType: Camera.EncodingType.PNG,
                    correctOrientation: true,  //Corrects Android orientation quirks
                    mediaType: Camera.MediaType.PICTURE
                });
            console.log("after picture");
        });
        */

        /*
        $("#btnImageFileCamera").on( 'change', function (event) {
            event.preventDefault();
            console.log("btnFileCamera");
            if ($("#btnImageFileCamera").val() === '') {   // cleared
                takeImagePage.showGrab();
                return;
            }

            fileList = $('#btnImageFileCamera').prop('files')
            if (fileList.length <= 0) {
                console.log("no files?");
                takeImagePage.showGrab();
                return;
            }

            file = fileList[0];
            takeImagePage.showImage(file);
        });
        */
        /*
        $("#btnImageFileUpload").on( 'change', function (event) {
            event.preventDefault();
            console.log("btnImageFileUpload");
            if ($("#btnImageFileUpload").val() === '') {   // cleared
                takeImagePage.showGrab();
                return;
            }

            fileList = $('#btnImageFileUpload').prop('files')
            if (fileList.length <= 0) {
                console.log("no files?");
                takeImagePage.showGrab();
                return;
            }

            file = fileList[0];
            takeImagePage.showImage(file);
        });
        console.log("takeImagePage initialize complete");
        */
    },

    leavePage: function () {
        loading(false);  // hide spinner
        BCApp.dataUrl = null;
        if (BCApp.xhr !== null) {
            console.log("cancelling ajax request");
            xhr.abort();
            BCApp.xhr = null;
        }

        $("#btnTakeImageSnap").off('click');
        $("#btnUploadImageSnap").off('click');

        navigator.camera.cleanup(cleanupSuccess, cleanupFailure);
    }
};



var validateResults = {
    initialize: function () {
        console.log("validateResults initialize");
        if (BCApp.jPalPayload===null) {       // usually would occur in debugging
            console.log("hmmm, no palette information...");
            $("body").pagecontainer("change", "#pgPreCapture", {}); // change page
            return;
        }

        $("#btnThisIsMe").on('click', function () {
            console.log("btnThisIsMe");
            BCApp.doPersist();
            $("body").pagecontainer("change", "#pgViewPalette", {}); // change page
        });


        $('#vldPalMiniSelfie').attr("src", "data:image/png;base64,"+BCApp.jPalPayload.miniSelfie);
        $('#vldPalSkin').attr("src", "data:image/png;base64,"+BCApp.jPalPayload.skinColors);
        $('#vldPalHair').attr("src", "data:image/png;base64,"+BCApp.jPalPayload.hairColors);
        $('#vldPalEye').attr("src", "data:image/png;base64,"+BCApp.jPalPayload.eyeColors);
     },
    leavePage: function() {
        console.log("validateResults leavePage");
        $("#btnThisIsMe").off('click');
    }
};


var viewPalette = {
    initialize: function () {
        console.log("viewPalette initialize");

        if (BCApp.jPalPayload===null) {       // usually would occur only in debugging
            console.log("hmmm, no palette information...");
            $("body").pagecontainer("change", "#pgHome", {}); // change page
            return;
        }

        $('#vwPalMiniSelfie').attr("src", "data:image/png;base64,"+BCApp.jPalPayload.miniSelfie);
        $('#vwPalWheel').attr("src", "data:image/png;base64,"+BCApp.jPalPayload.palWheel);
        $('#vwPalColors').attr("src", "data:image/png;base64,"+BCApp.jPalPayload.palette);
    }
};


var viewImageResults = {
    initialize: function () {
        console.log("viewImageResults initialize");

        if (BCApp.jPalPayload===null) {       // usually would occur in debugging
            console.log("hmmm, no palette information...");
            $("body").pagecontainer("change", "#pgHome", {}); // change page
            return;
        }

        $('#vwImageOriginalResults').attr("src", "data:image/png;base64,"+BCApp.jImagePayload.Original);
        $('#vwImageMatchResults').attr("src", "data:image/png;base64,"+BCApp.jImagePayload.Matched);
    }
};


var badResults = {
    initialize: function () {
        console.log("badResults initialize");
        if (BCApp.serverError !== null)
            $('#spShowError').text(BCApp.serverError);
        else
            $('#spShowError').text("Unknown error - sorry...");
     }
};


var badImageResults = {
    initialize: function () {
        console.log("badImageResults initialize");
        if (BCApp.serverError !== null)
            $('#spShowImageError').text(BCApp.serverError);
        else
            $('#spShowImageError').text("Unknown error - sorry...");
//        @returns { void}
     }
};

/********************
** Helper Functions
********************/
function jsguid() {
    function s4() {
        return Math.floor((1 + Math.random()) * 0x10000)
            .toString(16)
            .substring(1);
    }
    return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
/*
function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        var r = Math.random() * 16 | 0, v = c === 'x' ? r : r & 0x3 | 0x8;
        return v.toString(16);
    });
}
*/
function loading(showOrHide) {
    setTimeout(function () {
        $.mobile.loading(showOrHide ? 'show' : 'hide');
    }, 1);
}

// https://gist.github.com/kamranzafar/3136584
var toast = function (msg) {
    $("<div class='ui-loader ui-overlay-shadow ui-body-e ui-corner-all'><h3>" + msg + "</h3></div>")
        .css({
            display: "block",
            background: "white",
            opacity: 0.80,
            position: "fixed",
            padding: "7px",
            "text-align": "center",
            width: "270px",
            left: ($(window).width() - 284) / 2,
            top: $(window).height() / 2
        })
        .appendTo($.mobile.pageContainer).delay(2000)
        .fadeOut(500, function () {
            $(this).remove();
        });
};

function base64ToBlob(base64, mime) {
    mime = mime || '';
    var sliceSize = 1024;
    var byteChars = window.atob(base64);
    var byteArrays = [];

    for (var offset = 0, len = byteChars.length; offset < len; offset += sliceSize) {
        var slice = byteChars.slice(offset, offset + sliceSize);

        var byteNumbers = new Array(slice.length);
        for (var i = 0; i < slice.length; i++) {
            byteNumbers[i] = slice.charCodeAt(i);
        }

        var byteArray = new Uint8Array(byteNumbers);

        byteArrays.push(byteArray);
    }

    return new Blob(byteArrays, { type: mime });
}

function blobifyImage(imgData, mime) {
    var base64ImageContent = imgData.replace(/^data:image\/(png|jpg);base64,/, "");
    var blob = base64ToBlob(base64ImageContent, mime);
    return blob;
}

/********************
** Events
********************/

//document.addEventListener("deviceready", BCApp.initialize, false);


//$(document).on("deviceready", BCApp.initialize);        // Triggered after cordova is initialized




/********************
** Initialization - from index.js - template
********************/
/*
function onLoad() {
    console.log("onload");
//    document.addEventListener('deviceready', cordovaReady, false);  // fires when Cordova is ready
//    $(document).on("deviceready", cordovaReady);        // Triggered after cordova is initialized
//    $(document).on("deviceready", BCApp.initialize);        // Triggered after cordova is initialized
}
*/
/*
function cordovaReady() {
    console.log("cordovaReady");
    BCApp.initialize();
}
*/
/*
(function () {      // fired when DOM is loaded
    "use strict";
    $(document).on("deviceready", BCApp.initialize);        // Triggered after cordova is initialized

    document.addEventListener('deviceready', onDeviceReady.bind(this), false);  // fires when Cordova is ready
    function onDeviceReady() {
        console.log("onDeviceReady");
        BCApp.initialize();
    }

})();
*/

/*
(function () {
    "use strict";
    console.log("DOM loaded");
    document.addEventListener('deviceready', onDeviceReady.bind(this), false);

    function onDeviceReady() {
        console.log("onDeviceReady");
        BCApp.initialize();
    };
})();
*/



var app = {
    // Application Constructor
    initialize: function() {
        console.log("first initialize");
        document.addEventListener('deviceready', this.onDeviceReady.bind(this), false);
    },

    // deviceready Event Handler
    //
    // Bind any cordova events here. Common events are:
    // 'pause', 'resume', etc.
    onDeviceReady: function() {
        this.receivedEvent('deviceready');
    },

    // Update DOM on a Received Event
    receivedEvent: function(id) {
        var parentElement = document.getElementById(id);
        var listeningElement = parentElement.querySelector('.listening');
        var receivedElement = parentElement.querySelector('.received');

        listeningElement.setAttribute('style', 'display:none;');
        receivedElement.setAttribute('style', 'display:block;');

        console.log('Received Event: ' + id);
    }
};

//app.initialize();

BCApp.DOMinitialize();