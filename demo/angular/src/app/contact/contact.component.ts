import { Component, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-contact',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Contact Us</h1>
    <p>
      Get in touch with the aeo.js team for support, partnerships, or contributions.
    </p>
    <p>
      Reach us at hello&#64;aeojs.org or visit our GitHub repository at
      github.com/rubenmarcus/aeo.js. We welcome contributions, bug reports, and feature requests.
      For enterprise inquiries, email enterprise&#64;aeojs.org.
    </p>
  `,
})
export class ContactComponent {}
