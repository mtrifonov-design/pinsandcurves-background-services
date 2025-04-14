import { ProjectDataStructure, PinsAndCurvesProjectController } from "@mtrifonov-design/pinsandcurves-external";
import * as ext from "@mtrifonov-design/pinsandcurves-external";

function getController(dispatch : any, worm?: any) {
    const pb = new ProjectDataStructure.ProjectBuilder();
    pb.addContinuousSignal('signal1', 'signal 1', [0, 1]);
    pb.addPin('signal1', 20, 0, 'return easyLinear()');
    pb.addPin('signal1', 50, 1, 'return easyLinear()');
    pb.addPin('signal1', 60, 0, 'return easyLinear()');
    pb.setSignalActiveStatus('signal1', true);
    pb.addStaticStringSignal('HIDDEN_CODE', "__hidden_code", `
function setup() {
    createCanvas(400, 400);
}
function draw() {
    clear();
    background(220);
    circle(200, 200, signal("signal 1") * 100);
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