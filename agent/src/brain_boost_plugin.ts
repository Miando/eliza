import {
    Plugin,
} from "@ai16z/eliza";
import { gameFiKnowledgesProvider } from "./gamefi_knowledges_provider";
import {myProvider} from "./sample_provider.ts";

export const brainBoostPlugin: Plugin = {
    name: "brain-boost",
    description: "Brain boost plugin",
    actions: [],
    providers: [gameFiKnowledgesProvider, myProvider],
    evaluators: [],
    services: [],
    clients: [],
};

export default brainBoostPlugin;
