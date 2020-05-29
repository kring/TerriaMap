import CatalogMemberTraits from "terriajs/lib/Traits/CatalogMemberTraits";
import UrlTraits from "terriajs/lib/Traits/UrlTraits";
import mixTraits from "terriajs/lib/Traits/mixTraits";
import CreateModel from "terriajs/lib/Models/CreateModel";
import CatalogMemberMixin from "terriajs/lib/ModelMixins/CatalogMemberMixin";
import UrlMixin from "terriajs/lib/ModelMixins/UrlMixin";
import AsyncMappableMixin from "terriajs/lib/ModelMixins/AsyncMappableMixin";
import MappableTraits from "terriajs/lib/Traits/MappableTraits";
import { MapItem } from "terriajs/lib/Models/Mappable";

export class UnsupportedCatalogItemTraits extends mixTraits(
  CatalogMemberTraits,
  UrlTraits,
  MappableTraits
) {}

export default class UnsupportedCatalogItem extends AsyncMappableMixin(
  UrlMixin(CatalogMemberMixin(CreateModel(UnsupportedCatalogItemTraits)))
) {
  static readonly type = "unsupported";

  get type() {
    return UnsupportedCatalogItem.type;
  }

  protected forceLoadMetadata(): Promise<void> {
    return Promise.resolve();
  }

  get mapItems(): MapItem[] {
    return [];
  }

  protected forceLoadMapItems(): Promise<void> {
    return Promise.resolve();
  }
}
