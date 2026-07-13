import { publicEnvironment } from "../config/environment";

export const PRODUCT = Object.freeze({
  name: publicEnvironment.productName,
  locale: "en-PH",
  country: "Philippines",
  timezone: "Asia/Manila",
  currency: "PHP",
});
