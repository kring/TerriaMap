const fs = require("fs");
const URI = require("urijs");

const catalog = {
  catalog: [
    createTIE({
      name: "Cesium (Hypothetical Horse)",
      url: "https://3d.hypotheticalhorse.com"
    }),
    createTIE({
      name: "Helyx",
      url: "http://helyxapache2.eastus.azurecontainer.io/"
    }),
    createTIE({
      name: "Steinbeis",
      url: "http://steinbeis-3dps.eu:8080/3DContainerTile/"
    }),
    createTIE({
      name: "Skymantics",
      url: "http://13.82.99.186:5050/"
    }),
    createTIE({
      name: "Cognitics",
      url: "http://cdb.cognitics.net:3000/"
    }),
    createTIE({
      name: "Ecere",
      url: "https://maps.ecere.com/3DAPI/"
    })
  ]
};

fs.writeFileSync("simple.json", JSON.stringify(catalog, undefined, "  "), "utf8");

function createTIE(options) {
  const bbox = "-74.021,40.701,-73.990,40.775";

  return {
    name: options.name,
    type: "group",
    members: [
      {
        name: "All",
        type: "ogc3d",
        isGroup: true,
        url: options.url,
        override: {
          info: [
            {
              name: "OGC 3D Container and Tiles API",
              content: "This is the landing page. Opening this group tests the `LandingPage` TIE function."
            },
            {
              name: "OGC 3D Container and Tiles API URL",
              content: options.url
            }
          ]
        }
      },
      {
        name: "Inside New York bounding box",
        type: "ogc3d",
        isGroup: true,
        url: options.url,
        bbox: {
          west: -74.021,
          south: 40.701,
          east: -73.990,
          north: 40.775
        },
        override: {
          info: [
            {
              name: "OGC 3D Container and Tiles API",
              content: "This is the landing page. Opening this group tests the `LandingPage` TIE function. Collections and children in this group will be filtered to New York using `?bbox=" + bbox + "`. This group also tests the `CollectionsBboxQuery` and `3dContainerBboxQuery` TIE functions."
            },
            {
              name: "OGC 3D Container and Tiles API URL",
              content: options.url
            }
          ]
        }
      },
    ]
  };
}


