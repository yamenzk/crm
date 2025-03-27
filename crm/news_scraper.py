import requests
import time
import random
from bs4 import BeautifulSoup
from urllib.parse import urlencode
import base64
from newspaper import Article
import re
import json
import frappe


class GoogleNewsScraper:
    def __init__(self, config=None):
        self.config = {
            "prettyURLs": True,
            "getArticleContent": False,
            "useRSS": True,
            "timeframe": "7d",
            "queryVars": {},
            "filterWords": [],
            "limit": 99,
        }

        if config:
            self.config.update(config)

        self.session = requests.Session()
        self.session.headers.update(
            {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Referer": "https://www.google.com/",
                "DNT": "1",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1",
            }
        )

    def _build_query_string(self, query_vars):
        if not query_vars:
            return ""
        return "?" + urlencode(query_vars)

    def _get_pretty_url(self, ugly_url):
        if not ugly_url or "news.google.com/articles" in ugly_url:
            return ugly_url

        if (
            "news.google.com/read" in ugly_url
            or "news.google.com/rss/articles" in ugly_url
        ):
            try:
                response = self.session.get(ugly_url, allow_redirects=False)
                if (
                    response.status_code in (301, 302)
                    and "Location" in response.headers
                ):
                    return response.headers["Location"]

                # If no redirect, try base64 decoding approach
                base64_match = re.search(
                    r"/(?:read|articles)/([A-Za-z0-9-_]+)", ugly_url
                )
                if base64_match:
                    encoded_part = base64_match.group(1)

                    # Standard base64 to URL-safe base64
                    encoded_part = encoded_part.replace("-", "+").replace("_", "/")

                    # Add padding
                    padding = "=" * (4 - (len(encoded_part) % 4)) % 4
                    encoded_part += padding

                    try:
                        decoded = base64.b64decode(encoded_part).decode(
                            "utf-8", errors="ignore"
                        )
                        url_match = re.search(r'https?://[^\s"\'<>]+', decoded)
                        if url_match:
                            return url_match.group(0)
                    except:
                        pass
            except Exception as e:
                print(f"Error getting redirect URL: {str(e)}")

        return ugly_url

    def _get_article_type(self, article):
        if article.select("h4") or article.select("div > div + div > div a"):
            return "regular"
        if article.select("figure"):
            return "topicFeatured"
        if article.select("> a"):
            return "topicSmall"
        return ""

    def _get_title(self, article, article_type):
        try:
            if article_type == "regular":
                return (
                    article.select_one("h4").text
                    if article.select_one("h4")
                    else (
                        article.select_one("div > div + div > div a").text
                        if article.select_one("div > div + div > div a")
                        else ""
                    )
                )
            if article_type == "topicFeatured" or article_type == "topicSmall":
                return (
                    article.select_one('a[target="_blank"]').text
                    if article.select_one('a[target="_blank"]')
                    else (
                        article.select_one("button")["aria-label"].replace(
                            "More - ", ""
                        )
                        if article.select_one("button")
                        and "aria-label" in article.select_one("button").attrs
                        else ""
                    )
                )
            return ""
        except:
            return ""

    def _clean_text(self, text):
        unwanted_keywords = [
            "subscribe now",
            "sign up",
            "newsletter",
            "exclusive offer",
            "limited time offer",
            "free trial",
            "download now",
            "join now",
            "register today",
            "special promotion",
            "promotional offer",
            "discount code",
            "early access",
            "sneak peek",
            "save now",
            "don't miss out",
            "act now",
            "last chance",
            "expires soon",
            "giveaway",
            "free access",
            "premium access",
            "unlock full access",
            "buy now",
            "learn more",
            "click here",
            "follow us on",
            "share this article",
            "connect with us",
            "advertisement",
            "sponsored content",
            "partner content",
            "affiliate links",
            "for more information",
            "you may also like",
            "we think you'll like",
            "from our network",
        ] + self.config.get("filterWords", [])

        lines = text.split("\n")
        cleaned_lines = []

        for line in lines:
            line = line.strip()
            if len(line.split()) > 4 and not any(
                keyword in line.lower() for keyword in unwanted_keywords
            ):
                cleaned_lines.append(line)

        return "\n".join(cleaned_lines)

    def _get_article_content(self, article):
        max_retries = 3
        retry_delay = 2  # seconds

        for attempt in range(max_retries):
            try:
                url = article["link"]
                verify_messages = [
                    "you are human",
                    "are you human",
                    "i'm not a robot",
                    "recaptcha",
                ]

                # Add random delay to avoid rate limiting
                time.sleep(retry_delay + random.uniform(1, 3))

                news_article = Article(url)
                news_article.download()
                news_article.parse()

                text = news_article.text

                if not text:
                    print(f"Article content could not be parsed or is empty: {url}")
                    return {}

                if any(msg in text.lower() for msg in verify_messages):
                    print(f"Article requires human verification: {url}")
                    return {}

                cleaned_text = self._clean_text(text)

                if len(cleaned_text.split()) < 100:
                    print(f"Article content is too short: {url}")
                    return {}

                print(f"Successfully scraped article content from: {url}")

                return {"content": cleaned_text}

            except requests.exceptions.HTTPError as e:
                if (
                    hasattr(e, "response")
                    and e.response.status_code == 429
                    and attempt < max_retries - 1
                ):
                    wait_time = retry_delay * (
                        attempt + 2
                    )  # Increase wait time with each retry
                    print(
                        f"Rate limited. Waiting {wait_time}s before retry {attempt+1}/{max_retries}"
                    )
                    time.sleep(wait_time)
                else:
                    print(f"Error getting article content: {str(e)}")
                    return {}
            except Exception as e:
                print(f"Error getting article content: {str(e)}")
                return {}

        return {}

    def _get_source_info_from_rss(self):
        """Get source website URLs from RSS feed"""
        query_vars = self.config.get("queryVars", {}).copy()
        query_vars["when"] = self.config["timeframe"]

        if "searchTerm" in self.config:
            query_vars["q"] = self.config["searchTerm"]

        query_string = self._build_query_string(query_vars)
        base_url = "https://news.google.com/rss/search"
        url = f"{base_url}{query_string}"

        print(f"Getting source info from RSS: {url}")

        try:
            cookies = {
                "CONSENT": f'YES+cb.{time.strftime("%Y%m%d")}-04-p0.en-GB+FX+667',
            }

            response = self.session.get(url, cookies=cookies)

            if response.status_code != 200:
                print(f"Failed to retrieve RSS: {response.status_code}")
                return {}

            xml_content = response.text
            soup = BeautifulSoup(xml_content, "xml")

            items = soup.find_all("item")
            print(f"Found {len(items)} RSS items for source info")

            source_info = {}

            for item in items:
                title_elem = item.find("title") 
                if not title_elem:
                    continue

                # Extract the actual article title (not including source)
                title_text = title_elem.text
                # Remove source part if it exists (format: "Title - Source")
                if " - " in title_text:
                    parts = title_text.split(" - ")
                    title = " - ".join(parts[:-1])  # Join all parts except the last one (source)
                else:
                    title = title_text

                # Extract source from the description field if available
                description = item.find("description")
                source_name = ""
                if description:
                    # Parse the HTML in description
                    desc_soup = BeautifulSoup(description.text, "html.parser")
                    font_elem = desc_soup.find("font", color="#6f6f6f")
                    if font_elem:
                        source_name = font_elem.text.strip()

                # Extract source url from the source element
                source_elem = item.find("source")
                source_url = ""
                if source_elem and "url" in source_elem.attrs:
                    source_url = source_elem["url"]
                    # If no source name was found in description, use the source element text
                    if not source_name and source_elem.text:
                        source_name = source_elem.text

                if title and (source_name or source_url):
                    source_info[title] = {
                        "source_name": source_name,
                        "source_url": source_url
                    }

            print(f"Extracted {len(source_info)} source URLs from RSS")
            return source_info

        except Exception as e:
            import traceback
            print(f"Error getting source info from RSS: {str(e)}")
            print(traceback.format_exc())
            return {}

    def scrape(self):
        # Check if the search term is in Arabic to add proper language/region parameters
        if self.config.get("searchTerm") and any('\u0600' <= c <= '\u06FF' for c in self.config["searchTerm"]):
            # Arabic character range check
            print(f"Arabic search term detected: {self.config['searchTerm']}")
            query_vars = self.config.get("queryVars", {}).copy()
            # Add Arabic language and UAE region codes
            query_vars["hl"] = "ar"  # Arabic language
            query_vars["gl"] = "AE"  # UAE region code
            query_vars["ceid"] = "AE:ar"  # Country edition ID
            self.config["queryVars"] = query_vars
        
        # Get source website URLs from RSS if enabled
        source_info = {}
        if self.config["useRSS"]:
            source_info = self._get_source_info_from_rss()
        
        # Setup query parameters for HTML scraping
        query_vars = self.config.get("queryVars", {}).copy()
        query_vars["when"] = self.config["timeframe"]
        
        if "searchTerm" in self.config:
            query_vars["q"] = self.config["searchTerm"]
        
        query_string = self._build_query_string(query_vars)
        base_url = "https://news.google.com/search"
        url = f"{base_url}{query_string}"
        
        print(f"Scraping news from HTML: {url}")

        try:
            # Setting cookies for consent
            cookies = {
                "CONSENT": f'YES+cb.{time.strftime("%Y%m%d")}-04-p0.en-GB+FX+667',
            }

            response = self.session.get(url, cookies=cookies)

            if response.status_code != 200:
                print(f"Failed to retrieve page: {response.status_code}")
                return []

            html_content = response.text
            soup = BeautifulSoup(html_content, "html.parser")

            articles_elements = soup.select("article")
            print(f"Found {len(articles_elements)} article elements")

            results = []

            for article_elem in articles_elements:
                # Extract link
                link_elem = article_elem.select_one(
                    'a[href^="./article"]'
                ) or article_elem.select_one('a[href^="./read"]')
                if not link_elem:
                    continue

                link = link_elem["href"].replace("./", "https://news.google.com/")

                # Extract image
                img_elem = article_elem.select_one("figure img")
                image = ""
                if img_elem:
                    if "srcset" in img_elem.attrs:
                        srcset = img_elem["srcset"].split()
                        if len(srcset) >= 2:
                            image = srcset[-2]
                    elif "src" in img_elem.attrs:
                        image = img_elem["src"]

                if image and image.startswith("/"):
                    image = f"https://news.google.com{image}"

                # Get article type and title
                article_type = self._get_article_type(article_elem)
                title = self._get_title(article_elem, article_type)

                if not title:
                    continue

                # Get source and time
                source_elem = article_elem.select_one("div[data-n-tid]")
                source = source_elem.text if source_elem else ""

                # Extract favicon directly from Google's results
                favicon = ""
                favicon_elem = article_elem.select_one("img.qEdqNd")
                if favicon_elem:
                    if "src" in favicon_elem.attrs:
                        favicon = favicon_elem["src"]
                    elif "srcset" in favicon_elem.attrs:
                        srcset = favicon_elem["srcset"].split()
                        if srcset:
                            favicon = srcset[0]

                time_elem = article_elem.select_one("div:last-child time")
                time_text = time_elem.text if time_elem else ""
                datetime_attr = (
                    time_elem["datetime"]
                    if time_elem and "datetime" in time_elem.attrs
                    else ""
                )

                # Add source website URL from RSS data if available
                source_url = ""
                if title in source_info:
                    source_url = source_info[title]["source_url"]
                    # Use the source name from RSS if available
                    if not source and "source_name" in source_info[title]:
                        source = source_info[title]["source_name"]

                article_data = {
                    "title": title,
                    "link": link,
                    "image": image,
                    "source": source,
                    "source_url": source_url,
                    "favicon": favicon,
                    "datetime": datetime_attr,
                    "time": time_text,
                    "articleType": article_type,
                }

                results.append(article_data)

            # Apply limit before processing URLs and content
            if self.config["limit"] < len(results):
                print(f"Limiting results to {self.config['limit']} articles")
                results = results[: self.config["limit"]]

            # Process URLs if needed
            if self.config["prettyURLs"]:
                for i, article in enumerate(results):
                    print(f"Getting pretty URL for article {i+1}/{len(results)}")
                    pretty_url = self._get_pretty_url(article["link"])
                    if pretty_url:
                        article["link"] = pretty_url

            # Get article content if needed
            if self.config["getArticleContent"]:
                for i, article in enumerate(results):
                    print(f"Getting content for article {i+1}/{len(results)}")
                    content_data = self._get_article_content(article)
                    if content_data:
                        article["content"] = content_data.get("content", "")

            # Filter and return results
            filtered_results = [result for result in results if result.get("title")]
            return filtered_results

        except Exception as e:
            import traceback

            print(f"Error during scraping: {str(e)}")
            print(traceback.format_exc())
            return []


# Function to use in Frappe's scheduler
def scrape_and_store_news():
    """
    Function to be called by Frappe scheduler to scrape and store news
    for multiple search configurations
    """
    print("Starting news scraping...")

    # Get all active news search configurations
    search_configs = frappe.get_all(
        "News Search Config",
        filters={"enabled": 1},
        fields=[
            "name",
            "search_term",
            "limit",
            "category",
        ],
    )

    print(f"Found {len(search_configs)} active search configurations")

    if not search_configs:
        print("No active news search configurations found")
        return

    for config in search_configs:
        try:
            print(f"Processing news for search term: {config.search_term}")

            scraper_config = {
                "searchTerm": config.search_term,
                "prettyURLs": config.get_article_content == 1,
                "getArticleContent": config.get_article_content == 1,
                "useRSS": True,
                "timeframe": config.timeframe or "7d",
                "limit": config.limit or 10,
            }

            print(f"Starting scraper with config: {scraper_config}")
            scraper = GoogleNewsScraper(scraper_config)
            news_articles = scraper.scrape()

            print(
                f"Found {len(news_articles)} articles for search term: {config.search_term}"
            )

            # Store in Frappe DocType
            articles_added = 0
            for article in news_articles:
                # Check if article already exists
                existing = frappe.get_all(
                    "News",
                    filters={"title": article["title"]},
                    fields=["name"],
                )

                if not existing:
                    # Get or create News Source
                    source_name = article["source"]
                    source_url = article.get("source_url", "")

                    # Check if source exists
                    existing_source = frappe.get_all(
                        "News Source",
                        filters={"source_name": source_name},
                        fields=["name"],
                    )

                    if existing_source:
                        source_doc_name = existing_source[0].name
                    else:
                        # Create new source
                        source_doc = frappe.new_doc("News Source")
                        source_doc.source_name = source_name
                        source_doc.website_url = source_url
                        source_doc.insert(ignore_permissions=True)
                        source_doc_name = source_doc.name

                    # Create the news item
                    doc = frappe.new_doc("News")
                    doc.title = article["title"]
                    doc.link = article["link"]
                    # We'll handle the image separately
                    doc.source = source_doc_name  # Link field to News Source

                    # Parse and format the datetime properly
                    if article["datetime"]:
                        try:
                            # Convert ISO format to MySQL datetime
                            from datetime import datetime

                            parsed_date = datetime.strptime(
                                article["datetime"], "%Y-%m-%dT%H:%M:%SZ"
                            )
                            doc.published_date = parsed_date.strftime(
                                "%Y-%m-%d %H:%M:%S"
                            )
                        except Exception as e:
                            print(
                                f"Error parsing date: {article['datetime']} - {str(e)}"
                            )
                            doc.published_date = None
                    else:
                        doc.published_date = None

                    doc.article_type = article["articleType"]
                    doc.category = config.category

                    if "content" in article and article["content"]:
                        doc.content = article["content"]

                    # First insert the document
                    doc.insert(ignore_permissions=True)

                    # Then download and attach the image if available
                    if article["image"]:
                        try:
                            # Download the image
                            image_url = article["image"]
                            session = requests.Session()

                            # Set headers to mimic a browser
                            headers = {
                                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
                                "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
                                "Accept-Language": "en-US,en;q=0.5",
                                "Referer": "https://news.google.com/",
                            }

                            response = session.get(
                                image_url, headers=headers, allow_redirects=True
                            )

                            if response.status_code == 200:
                                # Generate a filename based on article title
                                import re

                                safe_title = (
                                    re.sub(r"[^\w\s-]", "", article["title"])
                                    .strip()
                                    .replace(" ", "_")
                                )
                                file_name = (
                                    f"{safe_title[:50]}.jpg"  # Limit filename length
                                )

                                # Attach file to document
                                from frappe.utils.file_manager import save_file

                                file_doc = save_file(
                                    file_name,
                                    response.content,
                                    "News",
                                    doc.name,
                                    is_private=0,
                                )

                                # Update the image field with the attached file URL
                                if file_doc:
                                    doc.image = file_doc.file_url
                                    doc.save()  # Save the document with the updated image field

                        except Exception as e:
                            import traceback

                            print(
                                f"Error downloading image for article {doc.name}: {str(e)}"
                            )
                            print(traceback.format_exc())
                            # Continue processing even if image download fails

                    articles_added += 1

            frappe.db.commit()
            print(
                f"Added {articles_added} new articles for search term: {config.search_term}"
            )

        except Exception as e:
            import traceback

            print(f"Error scraping news for {config.search_term}: {str(e)}")
            print(traceback.format_exc())
            # Continue with next config instead of breaking

    print("News scraping completed")
