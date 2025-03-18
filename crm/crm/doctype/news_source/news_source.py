# Copyright (c) 2025, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
import requests
from io import BytesIO
import base64


class NewsSource(Document):
    def before_insert(self):
        # Clean up URL if needed
        if self.website_url and not self.website_url.startswith("http"):
            self.website_url = "https://" + self.website_url

    def after_insert(self):
        self.fetch_favicon()

    def fetch_favicon(self):
        if not self.website_url:
            return

        try:
            # Extract domain
            from urllib.parse import urlparse

            domain = urlparse(self.website_url).netloc

            # Try to get favicon
            favicon_url = f"https://www.google.com/s2/favicons?domain={domain}&sz=64"

            # Download the favicon
            response = requests.get(favicon_url)
            if response.status_code == 200:
                file_content = response.content
                file_name = f"{domain.replace('.', '_')}_favicon.png"

                # Attach file to document
                from frappe.utils.file_manager import save_file

                file_doc = save_file(
                    file_name, file_content, "News Source", self.name, is_private=0
                )

                # Set the favicon field
                if file_doc:
                    self.favicon = file_doc.file_url
                    self.db_update()  # Save the document with the updated favicon field

        except Exception as e:
            import traceback

            frappe.log_error(
                f"Error fetching favicon: {str(e)}\n{traceback.format_exc()}",
                "News Source Favicon Error",
            )
