import frappe
from frappe import _


@frappe.whitelist()
def get_news_data(source=None, period=None, search_term=None):
    """
    Fetch news articles with sources and image data in a single call

    Args:
        source (str, optional): Filter by source name
        period (str, optional): Filter by time period (today, week, month)
        search_term (str, optional): Search in news titles

    Returns:
        dict: News data with articles and sources information
    """
    try:
        # Build filters for news
        filters = [["published_date", "is", "set"]]

        if source:
            filters.append(["source", "=", source])

        if search_term:
            filters.append(["news_title", "like", f"%{search_term}%"])

        if period:
            import datetime

            today = frappe.utils.today()

            if period == "today":
                filters.append(["published_date", ">=", today])
            elif period == "week":
                week_start = frappe.utils.add_days(today, -7)
                filters.append(["published_date", ">=", week_start])
            elif period == "month":
                month_start = frappe.utils.add_days(today, -30)
                filters.append(["published_date", ">=", month_start])

        # Get news articles
        news = frappe.get_all(
            "News",
            fields=["name", "news_title", "image", "source", "published_date", "link"],
            filters=filters,
            order_by="published_date desc",
        )

        # Process articles to prepare for frontend
        for article in news:
            article["published_date_str"] = frappe.utils.pretty_date(
                article["published_date"]
            )

        # Get all unique sources
        source_names = list(set(article["source"] for article in news))

        # Fetch sources data
        sources = {}
        if source_names:
            source_docs = frappe.get_all(
                "News Source",
                fields=["name", "source_name", "favicon"],
                filters=[["name", "in", source_names]],
            )

            # Create a dictionary for easier access
            for source in source_docs:
                sources[source.name] = {
                    "name": source.name,
                    "source_name": source.source_name,
                    "favicon": source.favicon,
                }

        # Get all sources for filter dropdown
        all_sources = frappe.get_all(
            "News Source", fields=["name", "source_name"], order_by="source_name asc"
        )

        return {
            "success": True,
            "news": news,
            "sources": sources,
            "all_sources": all_sources,
        }

    except Exception as e:
        frappe.log_error(f"Error in get_news_data: {str(e)}", "News API Error")
        return {"success": False, "error": str(e)}
