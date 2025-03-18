# Copyright (c) 2025, Yamen Zakhour and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document


class News(Document):
    def before_insert(self):
        # Clean up URL if needed
        if self.title:
            if len(self.title) > 70:
                # Find the last space within the first 70 characters
                last_space = self.title[:70].rfind(" ")
                if last_space > 0:
                    # Trim at the last space to preserve complete words
                    self.news_title = self.title[:last_space] + "..."
                else:
                    # If no space found, just cut at 67 characters and add ellipsis
                    self.news_title = self.title[:67] + "..."
            else:
                # If title is already 70 characters or less, use it as is
                self.news_title = self.title
