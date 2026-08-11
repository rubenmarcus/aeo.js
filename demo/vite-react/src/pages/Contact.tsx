import { PAGES } from '../../../../shared/content';

const { contact } = PAGES;

function Contact() {
  return (
    <div>
      <h1>{contact.heading}</h1>
      <p>{contact.description}</p>
      <p>{contact.body}</p>
      <p>
        Email: <a href="mailto:hello@aeojs.org">hello@aeojs.org</a>
      </p>
      <p>
        GitHub:{' '}
        <a
          href="https://github.com/rubenmarcus/aeo.js"
          target="_blank"
          rel="noopener noreferrer"
        >
          rubenmarcus/aeo.js
        </a>
      </p>
    </div>
  );
}

export default Contact;
