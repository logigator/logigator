import type { Locale } from '../common/locale';

/**
 * The wording of one mail. `{duration}` in the footnote is how long the link
 * works, written out in the mail's language.
 */
export interface MailStrings {
  subject: string;
  heading: string;
  /** Paragraphs between the greeting and the button. */
  body: string[];
  button: string;
  /** Below the button: how long the link works, and what to do if the mail was not expected. */
  footnote: string;
}

/** The lines every mail in a language shares. `{username}` is the recipient's. */
export interface CommonMailStrings {
  greeting: string;
  /** Introduces the bare link under the button, for clients that break it. */
  fallback: string;
  imprint: string;
  privacyPolicy: string;
}

export interface LocaleMailStrings {
  common: CommonMailStrings;
  mails: {
    verifyRegistration: MailStrings;
    verifyEmailChange: MailStrings;
    resetPassword: MailStrings;
  };
}

/**
 * Every mail the API sends, in each language the site speaks. The footer
 * labels are the site footer's, so a link reads the same on both ends.
 */
export const MAIL_STRINGS: Record<Locale, LocaleMailStrings> = {
  en: {
    common: {
      greeting: 'Hi {username},',
      fallback:
        'If the button does not work, copy this link into your browser:',
      imprint: 'Imprint',
      privacyPolicy: 'Privacy Policy'
    },
    mails: {
      verifyRegistration: {
        subject: 'Welcome to Logigator',
        heading: 'Welcome to Logigator',
        body: [
          'Confirm your email address to finish creating your account. You can sign in once it is confirmed.'
        ],
        button: 'Confirm email address',
        footnote:
          'This link works for {duration}. If you did not sign up for Logigator, you can ignore this email.'
      },
      verifyEmailChange: {
        subject: 'Confirm your new email address',
        heading: 'Confirm your new email address',
        body: [
          'You asked to change the email address of your Logigator account to this one. Your account keeps its current address until you confirm.'
        ],
        button: 'Confirm new address',
        footnote:
          'This link works for {duration}. If you did not ask for this change, you can ignore this email.'
      },
      resetPassword: {
        subject: 'Reset your password',
        heading: 'Reset your password',
        body: [
          'Someone asked to reset the password of your Logigator account. Choose a new one with the button below.'
        ],
        button: 'Choose a new password',
        footnote:
          'This link works for {duration}. If you did not ask for this, ignore this email and your password stays the same.'
      }
    }
  },
  de: {
    common: {
      greeting: 'Hallo {username},',
      fallback:
        'Falls der Button nicht funktioniert, kopiere diesen Link in deinen Browser:',
      imprint: 'Impressum',
      privacyPolicy: 'Datenschutzerklärung'
    },
    mails: {
      verifyRegistration: {
        subject: 'Willkommen bei Logigator',
        heading: 'Willkommen bei Logigator',
        body: [
          'Bestätige deine E-Mail-Adresse, um dein Konto fertig einzurichten. Danach kannst du dich anmelden.'
        ],
        button: 'E-Mail-Adresse bestätigen',
        footnote:
          'Der Link ist {duration} gültig. Wenn du dich nicht bei Logigator registriert hast, kannst du diese E-Mail ignorieren.'
      },
      verifyEmailChange: {
        subject: 'Bestätige deine neue E-Mail-Adresse',
        heading: 'Bestätige deine neue E-Mail-Adresse',
        body: [
          'Du möchtest die E-Mail-Adresse deines Logigator-Kontos auf diese Adresse ändern. Bis du sie bestätigst, behält dein Konto die bisherige Adresse.'
        ],
        button: 'Neue Adresse bestätigen',
        footnote:
          'Der Link ist {duration} gültig. Wenn du diese Änderung nicht angefordert hast, kannst du diese E-Mail ignorieren.'
      },
      resetPassword: {
        subject: 'Passwort zurücksetzen',
        heading: 'Passwort zurücksetzen',
        body: [
          'Für dein Logigator-Konto wurde ein neues Passwort angefordert. Über den Button unten legst du es fest.'
        ],
        button: 'Neues Passwort festlegen',
        footnote:
          'Der Link ist {duration} gültig. Wenn du das nicht angefordert hast, ignoriere diese E-Mail. Dein Passwort bleibt dann unverändert.'
      }
    }
  },
  es: {
    common: {
      greeting: 'Hola, {username}:',
      fallback: 'Si el botón no funciona, copia este enlace en tu navegador:',
      imprint: 'Aviso Legal',
      privacyPolicy: 'Política de Privacidad'
    },
    mails: {
      verifyRegistration: {
        subject: 'Bienvenido a Logigator',
        heading: 'Bienvenido a Logigator',
        body: [
          'Confirma tu dirección de correo para terminar de crear tu cuenta. Después podrás iniciar sesión.'
        ],
        button: 'Confirmar dirección de correo',
        footnote:
          'Este enlace es válido durante {duration}. Si no te registraste en Logigator, puedes ignorar este correo.'
      },
      verifyEmailChange: {
        subject: 'Confirma tu nueva dirección de correo',
        heading: 'Confirma tu nueva dirección de correo',
        body: [
          'Has pedido cambiar la dirección de correo de tu cuenta de Logigator a esta. Tu cuenta conserva la dirección actual hasta que la confirmes.'
        ],
        button: 'Confirmar nueva dirección',
        footnote:
          'Este enlace es válido durante {duration}. Si no pediste este cambio, puedes ignorar este correo.'
      },
      resetPassword: {
        subject: 'Restablece tu contraseña',
        heading: 'Restablece tu contraseña',
        body: [
          'Se ha pedido restablecer la contraseña de tu cuenta de Logigator. Elige una nueva con el botón de abajo.'
        ],
        button: 'Elegir una nueva contraseña',
        footnote:
          'Este enlace es válido durante {duration}. Si no lo pediste, ignora este correo y tu contraseña seguirá siendo la misma.'
      }
    }
  },
  fr: {
    common: {
      greeting: 'Bonjour {username},',
      fallback:
        'Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :',
      imprint: 'Mentions légales',
      privacyPolicy: 'Politique de confidentialité'
    },
    mails: {
      verifyRegistration: {
        subject: 'Bienvenue sur Logigator',
        heading: 'Bienvenue sur Logigator',
        body: [
          'Confirmez votre adresse e-mail pour terminer la création de votre compte. Vous pourrez ensuite vous connecter.'
        ],
        button: 'Confirmer l’adresse e-mail',
        footnote:
          'Ce lien est valable {duration}. Si vous ne vous êtes pas inscrit sur Logigator, vous pouvez ignorer cet e-mail.'
      },
      verifyEmailChange: {
        subject: 'Confirmez votre nouvelle adresse e-mail',
        heading: 'Confirmez votre nouvelle adresse e-mail',
        body: [
          'Vous avez demandé à remplacer l’adresse e-mail de votre compte Logigator par celle-ci. Votre compte garde son adresse actuelle jusqu’à votre confirmation.'
        ],
        button: 'Confirmer la nouvelle adresse',
        footnote:
          'Ce lien est valable {duration}. Si vous n’avez pas demandé ce changement, vous pouvez ignorer cet e-mail.'
      },
      resetPassword: {
        subject: 'Réinitialisez votre mot de passe',
        heading: 'Réinitialisez votre mot de passe',
        body: [
          'Une réinitialisation du mot de passe de votre compte Logigator a été demandée. Choisissez-en un nouveau avec le bouton ci-dessous.'
        ],
        button: 'Choisir un nouveau mot de passe',
        footnote:
          'Ce lien est valable {duration}. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail : votre mot de passe reste inchangé.'
      }
    }
  }
};
