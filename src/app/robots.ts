import { MetadataRoute } from "next";
import { RESTAURANT_DATA } from "@/data/restaurantData";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/api/"],
    },
    sitemap: `${RESTAURANT_DATA.seo.canonicalUrl}/sitemap.xml`,
  };
}
