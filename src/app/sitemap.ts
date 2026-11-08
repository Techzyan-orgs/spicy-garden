import { MetadataRoute } from "next";
import { RESTAURANT_DATA } from "@/data/restaurantData";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: RESTAURANT_DATA.seo.canonicalUrl,
      lastModified: new Date(),
      changeFrequency: "weekly",
      priority: 1.0,
    },
  ];
}
