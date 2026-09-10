export const PUBLIC_CONTACT_LINKS = Object.freeze({
  facebook: Object.freeze({
    id: "facebook",
    enabled: true,
    label: "Facebook",
    url: "https://www.facebook.com/mabu.m.bu.3",
    external: true
  }),
  zalo: Object.freeze({
    id: "zalo",
    enabled: true,
    label: "Chat Zalo",
    url: "https://zalo.me/0933712571",
    external: true
  }),
  phone: Object.freeze({
    id: "phone",
    enabled: true,
    label: "0933.712.571",
    number: "0933712571",
    url: "tel:0933712571",
    external: false
  })
});

export function getEnabledPublicContactLinks(contacts = PUBLIC_CONTACT_LINKS) {
  return Object.values(contacts || {}).filter((contact) => (
    contact?.enabled === true && typeof contact.url === "string" && contact.url.trim().length > 0
  ));
}
