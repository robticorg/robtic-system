import { FeatureCatalogRepository } from "@database/repositories";
import { listFeatureManifests } from "@core/features";
import { Logger } from "@logger";

const CTX = "features";

export async function publishFeatureCatalog(): Promise<void> {
    const manifests = listFeatureManifests();

    await FeatureCatalogRepository.publish(manifests.map(m => ({
        key: m.key,
        description: m.description,
        activation: m.activation,
        commands: m.commands.map(c => c.name),
    }))).catch(err => {
        Logger.warn(`Could not publish the feature catalog: ${err}`, CTX);
    });

    Logger.debug(`Published ${manifests.length} feature(s) to the catalog`, CTX);
}
