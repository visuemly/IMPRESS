document.addEventListener("DOMContentLoaded", function() {
    const video = document.getElementById("myvideo");
    const canvas = document.getElementById("canvas");
    const context = canvas.getContext("2d");
    let trackButton = document.getElementById("trackbutton");
    let updateNote = document.getElementById("updatenote");
    
    let isVideo = false;
    let model = null;
    let predictions = [];
  
    setTimeout(function() {
      toggleVideo();
    }, 1000);
  
    const modelParams = {
      flipHorizontal: true, // flip e.g for video
      maxNumBoxes: 20, // maximum number of boxes to detect
      iouThreshold: 0.5, // ioU threshold for non-max suppression
      scoreThreshold: 0.6, // confidence threshold for predictions.
    };
    
    function startVideo() {
      handTrack.startVideo(video).then(function (status) {
        console.log("video started", status);
        if (status) {
          isVideo = true;
          runDetection();
        } else {
        }
      });
    }
    
    function toggleVideo() {
      if (!isVideo) {
        startVideo();
      } else {
        handTrack.stopVideo(video);
        isVideo = false;
      }
    }
    
    function runDetection() {
      model.detect(video).then((_predictions) => {
        // console.log("Predictions: ", _predictions);
        draw(_predictions)
        model.renderPredictions(_predictions, canvas, context, video);
        predictions = _predictions;
        if (isVideo) {
          requestAnimationFrame(runDetection);
        }
      });
    }
    
    // Load the model.
    handTrack.load(modelParams).then((lmodel) => {
      model = lmodel;
    });
    
  });
  