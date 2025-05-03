import { ProjectDataStructure, PinsAndCurvesProjectController } from "@mtrifonov-design/pinsandcurves-external";
import * as ext from "@mtrifonov-design/pinsandcurves-external";

function getController(dispatch : any, project: ProjectDataStructure.PinsAndCurvesProject) {
    let controller = PinsAndCurvesProjectController.PinsAndCurvesProjectController
        .Host(dispatch, project);
    return controller;
}

export default getController;