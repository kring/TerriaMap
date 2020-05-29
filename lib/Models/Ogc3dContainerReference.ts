import { toJS } from "mobx";
import filterOutUndefined from "terriajs/lib/Core/filterOutUndefined";
import { JsonObject } from "terriajs/lib/Core/Json";
import loadJson from "terriajs/lib/Core/loadJson";
import ReferenceMixin from "terriajs/lib/ModelMixins/ReferenceMixin";
import UrlMixin from "terriajs/lib/ModelMixins/UrlMixin";
import CatalogGroup from "terriajs/lib/Models/CatalogGroupNew";
import Cesium3DTilesCatalogItem from "terriajs/lib/Models/Cesium3DTilesCatalogItem";
import CommonStrata from "terriajs/lib/Models/CommonStrata";
import CreateModel from "terriajs/lib/Models/CreateModel";
import { BaseModel } from "terriajs/lib/Models/Model";
import proxyCatalogItemUrl from "terriajs/lib/Models/proxyCatalogItemUrl";
import Terria from "terriajs/lib/Models/Terria";
import updateModelFromJson from "terriajs/lib/Models/updateModelFromJson";
import anyTrait from "terriajs/lib/Traits/anyTrait";
import CatalogMemberReferenceTraits from "terriajs/lib/Traits/CatalogMemberReferenceTraits";
import { RectangleTraits } from "terriajs/lib/Traits/MappableTraits";
import mixTraits from "terriajs/lib/Traits/mixTraits";
import objectTrait from "terriajs/lib/Traits/objectTrait";
import UrlTraits from "terriajs/lib/Traits/UrlTraits";
import URI from "urijs";

export class Ogc3dContainerReferenceTraits extends mixTraits(
  CatalogMemberReferenceTraits,
  UrlTraits
) {
  @objectTrait({
    type: RectangleTraits,
    name: "Bounding Box",
    description: "The bounding box used to filter the collections and children."
  })
  bbox?: RectangleTraits;

  @anyTrait({
    name: "Override",
    description:
      "The properties to apply to the dereferenced item, overriding properties that " +
      "come from the OGC API itself."
  })
  override?: JsonObject;
}

export default class Ogc3dContainerReference extends UrlMixin(
  ReferenceMixin(CreateModel(Ogc3dContainerReferenceTraits))
) {
  static readonly type = "ogc3d";

  get type() {
    return Ogc3dContainerReference.type;
  }

  protected forceLoadReference(
    previousTarget: BaseModel | undefined
  ): Promise<BaseModel | undefined> {
    if (this.uri === undefined) {
      return Promise.resolve(undefined);
    }

    const id = this.uniqueId;
    const name = this.name;
    const override = toJS(this.override);

    const uri = this.uri.clone();

    if (this.bbox && this.bbox.west !== undefined) {
      uri.addQuery(
        "bbox",
        `${this.bbox.west},${this.bbox.south},${this.bbox.east},${this.bbox.north}`
      );
    }

    const proxiedUrl = proxyCatalogItemUrl(this, uri.toString(), "0d");
    return loadJson(proxiedUrl).then(json => {
      if (json.id !== undefined) {
        let group: CatalogGroup;
        if (previousTarget && previousTarget instanceof CatalogGroup) {
          group = previousTarget;
        } else {
          group = new CatalogGroup(id, this.terria, this);
        }

        group.setTrait(CommonStrata.definition, "name", this.name);
        group.setTrait(
          CommonStrata.definition,
          "description",
          json.description
        );

        if (override) {
          updateModelFromJson(group, CommonStrata.override, override, true);
        }

        const collectionId = id + "/" + json.id;

        const children = json.children || [];
        if (children.length > 0) {
          group.addMembersFromJson(CommonStrata.definition, [
            {
              name: "children",
              type: "group",
              description: " ",
              info: [
                {
                  name: "3D Container and Tiles API",
                  content: "This is the `children` property of a 3D container."
                }
              ],
              members: filterOutUndefined(
                children.map((item: any) => {
                  const links = item.links;
                  const selfLinks = links.filter(
                    (link: any) =>
                      link.rel === "self" && link.href !== undefined
                  );
                  if (selfLinks.length === 0) {
                    return undefined;
                  }

                  const resolvedUri = URI(selfLinks[0].href).absoluteTo(uri);

                  return {
                    name: item.title,
                    type: "ogc3d",
                    url: resolvedUri.toString(),
                    isGroup: true,
                    bbox:
                      this.bbox.west !== undefined
                        ? {
                            west: this.bbox.west,
                            south: this.bbox.south,
                            east: this.bbox.east,
                            north: this.bbox.north
                          }
                        : undefined,
                    override: {
                      description:
                        "This is a child collection discovered from the `children` property of another collection.",
                      info: [
                        {
                          name: "OGC 3D Container and Tiles API URL",
                          content: resolvedUri.toString()
                        }
                      ]
                    }
                  };
                })
              )
            }
          ]);
        }

        const content = json.content;

        if (content && content.length > 0) {
          group.addMembersFromJson(CommonStrata.definition, [
            {
              name: "content",
              type: "group",
              description: " ",
              info: [
                {
                  name: "3D Container and Tiles API",
                  content: "This is the `content` property of a 3D Container."
                }
              ],
              members: filterOutUndefined(
                content.map((item: any) => {
                  const resolvedUri = URI(item.href).absoluteTo(uri);

                  const result: any = {
                    name:
                      this.name +
                      " - " +
                      (item.title ? item.title : "Unnamed Distribution"),
                    nameInCatalog: item.title || "Unnamed distribution",
                    url: resolvedUri.toString(),
                    description: item.description || " ",
                    info: [
                      {
                        name: "3D Container and Tiles API",
                        content:
                          "This is a distribution discovered in the `content` property of a 3D container."
                      },
                      {
                        name: "Relationship",
                        content: item.rel
                      }
                    ]
                  };

                  if (
                    item.type === "application/3dtiles+json" ||
                    item.type === "application/json+3dtiles"
                  ) {
                    result.type = "3d-tiles";
                  } else if (
                    item.type === "application/i3s+json" ||
                    item.type === "application/json+i3s"
                  ) {
                    result.type = "3d-tiles";
                    result.url =
                      "https://nsw.digitaltwin.terria.io/i3s-to-3dtiles/" +
                      result.url;
                    result.info.push({
                      name: "i3s to 3D Tiles",
                      content:
                        "This layer will be automatically converted from i3s to 3D Tiles using a service developed by the [Terria team](https://terria.io) at [CSIRO's Data61](https://data61.csiro.au/)."
                    });
                  } else {
                    result.type = "unsupported";
                    result.info.push({
                      name: "Unsupported",
                      content: `This client does not support 3D container distributions of type \`${item.type}\``
                    });
                  }

                  return result;
                })
              )
            }
          ]);
        }

        const links = (json.links || []).filter(
          (link: any) => link.rel === "item" || link.rel === "items"
        );
        if (links.length > 0) {
          group.addMembersFromJson(CommonStrata.definition, [
            {
              name: "links",
              type: "group",
              description: " ",
              info: [
                {
                  name: "3D Container and Tiles API",
                  content: "This is the `links` property of a 3D Container."
                }
              ],
              members: filterOutUndefined(
                links.map((item: any) => {
                  const resolvedUri = URI(item.href).absoluteTo(uri);

                  const result: any = {
                    name:
                      this.name +
                      " - " +
                      (item.title ? item.title : "Unnamed Distribution"),
                    nameInCatalog: item.title || "Unnamed distribution",
                    url: resolvedUri.toString(),
                    description: item.description || " ",
                    info: [
                      {
                        name: "3D Container and Tiles API",
                        content:
                          "This is a distribution discovered in the `links` property of a 3D container."
                      }
                    ]
                  };

                  if (
                    item.type === "application/3dtiles+json" ||
                    item.type === "application/json+3dtiles"
                  ) {
                    result.type = "3d-tiles";
                  } else if (
                    item.type === "application/i3s+json" ||
                    item.type === "application/json+i3s"
                  ) {
                    result.type = "3d-tiles";
                    result.url =
                      "https://nsw.digitaltwin.terria.io/i3s-to-3dtiles/" +
                      result.url;
                    result.info.push({
                      name: "i3s to 3D Tiles",
                      content:
                        "This layer will be automatically converted from i3s to 3D Tiles using a service developed by the [Terria team](https://terria.io) at [CSIRO's Data61](https://data61.csiro.au/)."
                    });
                  } else {
                    result.type = "unsupported";
                    result.info.push({
                      name: "Unsupported",
                      content: `This client does not support 3D container distributions of type ${item.type}`
                    });
                  }

                  return result;
                })
              )
            }
          ]);
        }

        return group;
      } else if (json.collections !== undefined) {
        let group: CatalogGroup;
        if (previousTarget && previousTarget instanceof CatalogGroup) {
          group = previousTarget;
        } else {
          group = new CatalogGroup(id, this.terria, this);
        }

        group.setTrait(CommonStrata.definition, "name", this.name);

        if (override) {
          updateModelFromJson(group, CommonStrata.override, override, true);
        }

        const collections = json.collections;
        group.addMembersFromJson(
          CommonStrata.definition,
          filterOutUndefined(
            collections.map((collection: any) => {
              const links = collection.links;
              const selfLinks = (links || []).filter(
                (link: any) => link.rel === "self" && link.href !== undefined
              );
              if (selfLinks.length === 0) {
                return undefined;
              }

              const resolvedUri = URI(selfLinks[0].href).absoluteTo(uri);

              return {
                name: collection.title,
                type: "ogc3d",
                url: resolvedUri.toString(),
                isGroup: true,
                bbox:
                  this.bbox.west !== undefined
                    ? {
                        west: this.bbox.west,
                        south: this.bbox.south,
                        east: this.bbox.east,
                        north: this.bbox.north
                      }
                    : undefined,
                override: {
                  description:
                    "This is a collection discovered from the `/collections` service. Opening this group tests the `3dContainerInfo` TIE function. If this group contains a `content` group, then the `3dContentDistribution` TIE function also passed.",
                  info: [
                    {
                      name: "OGC 3D Container and Tiles API URL",
                      content: resolvedUri.toString()
                    }
                  ]
                }
              };
            })
          )
        );

        return group;
      } else if (json.links !== undefined) {
        let group: CatalogGroup;
        if (previousTarget && previousTarget instanceof CatalogGroup) {
          group = previousTarget;
        } else {
          group = new CatalogGroup(id, this.terria, this);
        }

        group.setTrait(CommonStrata.definition, "name", this.name);

        if (override) {
          updateModelFromJson(group, CommonStrata.override, override, true);
        }

        const links = json.links;
        const dataLinks = links.filter(
          (link: any) => link.rel === "data" && link.href !== undefined
        );
        if (dataLinks.length === 0) {
          return undefined;
        }

        const firstDataLink = dataLinks[0];
        const resolvedUri = URI(firstDataLink.href).absoluteTo(uri);

        group.addMembersFromJson(CommonStrata.definition, [
          {
            name: "data",
            type: "ogc3d",
            url: resolvedUri.toString(),
            isGroup: true,
            bbox:
              this.bbox.west !== undefined
                ? {
                    west: this.bbox.west,
                    south: this.bbox.south,
                    east: this.bbox.east,
                    north: this.bbox.north
                  }
                : undefined,
            override: {
              description:
                'This is the link with `"rel": "data"` discovered from the landing page service. Opening this group tests the `CollectionsInfo` TIE function.',
              info: [
                {
                  name: "OGC 3D Container and Tiles API URL",
                  content: resolvedUri.toString()
                }
              ]
            }
          }
        ]);

        return group;
      }
      return undefined;
    });
  }

  private static loadFromLandingPage(
    terria: Terria,
    sourceReference: BaseModel | undefined,
    id: string | undefined,
    name: string | undefined,
    json: any,
    previousTarget: BaseModel | undefined,
    override: JsonObject | undefined,
    proxiedLandingPageUrl: string
  ): Promise<BaseModel | undefined> {
    const links = json.links;
    const dataLinks = links.filter(
      (link: any) => link.rel === "data" && link.href !== undefined
    );
    if (dataLinks.length === 0) {
      return Promise.resolve(undefined);
    }

    const firstDataLink = dataLinks[0];
    const resolvedUri = URI(firstDataLink.href).absoluteTo(
      proxiedLandingPageUrl
    );
    const proxiedUrl = proxyCatalogItemUrl(
      sourceReference,
      resolvedUri.toString(),
      "0d"
    );
    return loadJson(proxiedUrl).then(json => {
      if (json.collections !== undefined) {
        return Ogc3dContainerReference.loadFromCollections(
          terria,
          sourceReference,
          id,
          name,
          json,
          previousTarget,
          override,
          proxiedUrl
        );
      }
      return undefined;
    });
  }

  private static loadFromCollections(
    terria: Terria,
    sourceReference: BaseModel | undefined,
    id: string | undefined,
    name: string | undefined,
    json: any,
    previousTarget: BaseModel | undefined,
    override: JsonObject | undefined,
    proxiedCollectionsUrl: string
  ): Promise<BaseModel | undefined> {
    return Ogc3dContainerReference.loadGroup(
      terria,
      sourceReference,
      id,
      name,
      json,
      previousTarget,
      override,
      proxiedCollectionsUrl
    );
  }

  private static loadGroup(
    terria: Terria,
    sourceReference: BaseModel | undefined,
    id: string | undefined,
    name: string | undefined,
    json: any,
    previousTarget: BaseModel | undefined,
    override: JsonObject | undefined,
    proxiedCollectionsUrl: string
  ): Promise<BaseModel> {
    let group: BaseModel;
    if (previousTarget && previousTarget instanceof CatalogGroup) {
      group = previousTarget;
    } else {
      group = new CatalogGroup(id, terria, sourceReference);
    }

    group.setTrait(CommonStrata.definition, "name", name);

    const collections = json.collections || json.children;

    const ids = filterOutUndefined(
      collections.map((collection: any) => {
        const collectionId = id + "/" + collection.id;

        let collectionGroup: CatalogGroup | undefined;

        const links = collection.links || [];

        const children = collection.children || [];
        if (children.length > 0) {
          const selfLink = links.filter((link: any) => link.rel === "self")[0];
          if (selfLink) {
            const resolvedUri = URI(selfLink.href).absoluteTo(
              proxiedCollectionsUrl
            );
            const proxiedUrl = proxyCatalogItemUrl(
              sourceReference,
              resolvedUri.toString(),
              "0d"
            );

            const nestedGroup = new Ogc3dContainerReference(
              collectionId,
              terria
            );
            nestedGroup.setTrait(
              CommonStrata.definition,
              "name",
              collection.title
            );
            nestedGroup.setTrait(CommonStrata.definition, "url", proxiedUrl);
            nestedGroup.setTrait(CommonStrata.definition, "isGroup", true);

            terria.addModel(nestedGroup);

            return nestedGroup.uniqueId;
          }
        }

        const content = collection.content || [];
        const allItems = links.concat(content);

        if (allItems.length === 0) {
          return undefined;
        }

        const compatibleLinks = allItems.filter(
          (link: any) => link.type === "application/json+3dtiles"
        );
        if (compatibleLinks.length === 0) {
          return undefined;
        }

        const existing = terria.getModelById(BaseModel, collectionId);
        const model =
          existing && existing.type === Cesium3DTilesCatalogItem.type
            ? existing
            : new Cesium3DTilesCatalogItem(collectionId, terria);

        if (existing === undefined) {
          terria.addModel(model);
        }

        model.setTrait(CommonStrata.definition, "name", collection.title);
        model.setTrait(
          CommonStrata.definition,
          "description",
          collection.description
        );

        const resolvedUri = URI(compatibleLinks[0].href).absoluteTo(
          proxiedCollectionsUrl
        );
        model.setTrait(CommonStrata.definition, "url", resolvedUri.toString());

        return model.uniqueId;
      })
    );

    group.setTrait(CommonStrata.definition, "members", ids);

    if (override) {
      updateModelFromJson(group, CommonStrata.override, override, true);
    }

    return Promise.resolve(group);
  }
}
