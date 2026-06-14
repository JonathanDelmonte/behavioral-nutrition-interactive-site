export const CONTACT = {
  phoneLabel: "(32) 99971-1717",
  whatsappNumber: "5532999711717",
  whatsappMessage:
    "Oi, Juliana! Vim pelo site e gostaria de conversar sobre acompanhamento nutricional. Pode me orientar sobre os próximos passos?",
  email: "julianaadelmonte@gmail.com",
  instagram: "@nutrijuliana_delmonte",
  instagramUrl: "https://www.instagram.com/nutrijuliana_delmonte",
  mapsUrl:
    "https://maps.google.com/maps?vet=10CAAQoqAOahcKEwiQ3IGlpYaVAxUAAAAAHQAAAAAQCQ..i&client=opera-gx&pvq=CgsvZy8xdnBwdHF4diIVCg9lbmVyZ3kgcG93ZXIgamYQAhgD&lqi=Cg9lbmVyZ3kgcG93ZXIgamZImrfz2uqAgIAIWicQABABEAIYABgBGAIiD2VuZXJneSBwb3dlciBqZioICAIQABABEAKSAR12aXRhbWluX2FuZF9zdXBwbGVtZW50c19zdG9yZZoBJENoZERTVWhOTUc5blMwVkpRMEZuU1VSb2JVbFVkRzFCUlJBQvoBBAgpECU&fvr=1&cs=1&um=1&ie=UTF-8&fb=1&gl=br&sa=X&ftid=0x989ca055861db1:0x4e2ad9b940e96bea",
} as const;

export const WHATSAPP_HREF = `https://wa.me/${CONTACT.whatsappNumber}?text=${encodeURIComponent(CONTACT.whatsappMessage)}`;
