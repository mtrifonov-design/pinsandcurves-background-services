import { ProjectDataStructure, PinsAndCurvesProjectController } from "@mtrifonov-design/pinsandcurves-external";
import * as ext from "@mtrifonov-design/pinsandcurves-external";

function getController(dispatch : any, worm?: any) {
    const pb = new ProjectDataStructure.ProjectBuilder();
    pb.setTimelineData(900,30,0);
    pb.addContinuousSignal('s1', 'Signal 1', [0, 1]);
    pb.addPin('s1', 20, 0, 'return easyLinear()');
    pb.addPin('s1', 50, 1, 'return easyLinear()');
    pb.addPin('s1', 60, 0, 'return easyLinear()');
    pb.setSignalActiveStatus('s1', true);
    pb.addStaticStringSignal('HIDDEN_CODE', "__hidden_code", `
function setup() {
  setupCanvas(1920, 1080);
}
function draw() {
    clear();
    background(220);
    circle(200, 200, signal("Signal 1") * 100);
}
`)
    let controller;
    if (worm) {
        controller = PinsAndCurvesProjectController.PinsAndCurvesProjectController
        .HostFromSerializedWorm(dispatch,worm);
    } else {
        controller = PinsAndCurvesProjectController.PinsAndCurvesProjectController
        .Host(dispatch, pb.getProject());
    }
    return controller;
}

export default getController;