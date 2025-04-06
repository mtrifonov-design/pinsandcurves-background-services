import { ProjectDataStructure, PinsAndCurvesProjectController } from "@mtrifonov-design/pinsandcurves-external";
import * as ext from "@mtrifonov-design/pinsandcurves-external";

function getController(dispatch : any) {
    //sendMessage("CORE::CORE::CORE", "getController");
    const pb = new ProjectDataStructure.ProjectBuilder();
    pb.addContinuousSignal('signal1', 'signal1.x', [1, 5]);
    pb.addPin('signal1', 20, 1, 'return easyLinear()');
    pb.addPin('signal1', 50, 2, 'return easyLinear()');
    pb.addPin('signal1', 60, 3, 'return easyLinear()');
    pb.setSignalActiveStatus('signal1', true);
    pb.addContinuousSignal('signal3', 'folder1.signal1.y', [1, 5]);
    pb.addPin('signal3', 20, 1, 'return easyLinear()');
    pb.addPin('signal3', 50, 2, 'return easyLinear()');
    pb.addPin('signal3', 60, 3, 'return easyLinear()');
    pb.setSignalActiveStatus('signal3', true);
    pb.addDiscreteSignal('signal2', 'folder1.signal1.x');
    pb.addPin('signal2', 15, "A");
    pb.addPin('signal2', 25, "B");
    pb.addPin('signal2', 35, "C");
    pb.addPin('signal2', 45, "D");
    pb.setSignalActiveStatus('signal2', true);
    pb.addStaticNumberSignal('signal4', 'folder1.signal1.x', [1, 5], 3);
    pb.addStaticNumberSignal('signal5', 'folder1.signal1.x', [1, 5], 3);
    pb.addStaticNumberSignal('signal6', 'folder1.signal1.x', [1, 5], 3);
    pb.addStaticNumberSignal('signal7', 'folder1.signal1.x', [1, 5], 3);
    pb.addStaticNumberSignal('signal8', 'folder1.signal1.x', [1, 5], 3);
    pb.addStaticStringSignal('HIDDEN_CODE', "__hidden_code", "function setup() {\n    createCanvas(400, 400);\n    background(220);\n  }")
    // sendMessage("CORE::CORE::CORE", "getController2");
    // sendMessage("CORE::CORE::CORE", ext.ProjectDataStructure);
    // sendMessage("CORE::CORE::CORE", ProjectDataStructure);
    const controller = PinsAndCurvesProjectController.PinsAndCurvesProjectController.Host(
        dispatch,
        pb.getProject(),
    )
    // sendMessage("CORE::CORE::CORE", "getController3");
    return controller;
}

export default getController;