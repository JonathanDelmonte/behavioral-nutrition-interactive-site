export const CONTACT = {
  phoneLabel: "(32) 99971-1717",
  whatsappNumber: "5532999711717",
  whatsappMessage:
    "Oi, Juliana! Vim pelo site e gostaria de conversar sobre acompanhamento nutricional. Pode me orientar sobre os próximos passos?",
  email: "julianaadelmonte@gmail.com",
  instagram: "@nutrijuliana_delmonte",
  instagramUrl: "https://www.instagram.com/nutrijuliana_delmonte",
  // Maps URL API (documented, stable) com o endereço por extenso — o link
  // antigo era um URL de sessão copiado do navegador (client=opera-gx, lqi
  // "energy power jf" com categoria de loja de suplementos), que arriscava
  // abrir a listagem ERRADA no Google Maps.
  mapsUrl:
    "https://www.google.com/maps/search/?api=1&query=" +
    encodeURIComponent(
      "R. Barão de São João Nepomuceno, 236 - Centro, Juiz de Fora - MG, 36010-081",
    ),
} as const;

export const WHATSAPP_HREF = `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(CONTACT.whatsappMessage)}`;
