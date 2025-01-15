import {
    Plugin,
} from "@ai16z/eliza";
import { gameFiKnowledgesProvider } from "./gamefi_knowledges_provider";

export const brainBoostPlugin: Plugin = {
    name: "brain-boost",
    description: "Brain boost plugin",
    actions: [],
    providers: [gameFiKnowledgesProvider],
    evaluators: [],
    services: [],
    clients: [],
};
