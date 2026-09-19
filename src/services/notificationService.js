import Notification from "../models/Notification.js";
import Alert from "../models/Alert.js";

export async function notify({ user, title, body, icon = "notifications", type = "system", link }) {
  return Notification.create({ user, title, body, icon, type, link });
}

export async function notifyMany(userIds, payload) {
  if (!userIds?.length) return [];
  return Notification.insertMany(userIds.map((user) => ({ user, ...payload })));
}

// When a listing goes LIVE, notify every buyer whose saved alert matches it.
export async function matchAlertsForProperty(property) {
  const alerts = await Alert.find({ active: true });
  const matched = [];
  for (const alert of alerts) {
    const q = alert.toPropertyQuery();
    let ok = true;
    if (q.county && property.county !== q.county) ok = false;
    if (ok && alert.location) {
      const re = new RegExp(alert.location, "i");
      if (!re.test(property.suburb) && !re.test(property.county)) ok = false;
    }
    if (ok && alert.propertyTypes?.length && !alert.propertyTypes.includes(property.type)) ok = false;
    if (ok && alert.minBeds && property.beds < alert.minBeds) ok = false;
    if (ok && alert.maxPrice && property.price > alert.maxPrice) ok = false;
    if (ok && alert.maxMonthlyPayment && property.monthlyPayment > alert.maxMonthlyPayment) ok = false;

    if (ok) {
      matched.push(alert);
      await notify({
        user: alert.user,
        title: "New Listing Match",
        body: `${property.title} in ${property.location} matches your "${alert.name}" alert.`,
        icon: "home_work",
        type: "alert",
        link: `/properties/${property.slug}`,
      });
      alert.lastMatchedAt = new Date();
      alert.matchCount += 1;
      await alert.save();
    }
  }
  return matched;
}
