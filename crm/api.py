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



@frappe.whitelist()
def get_developer_contact_for_project(project_name):
    """
    Get developer contact details for a project, bypassing Contact permissions
    but respecting Project permissions
    """
    # Check if user has read permission for the Project
    if not frappe.has_permission("Project", "read", project_name):
        frappe.throw(_("Not permitted to access this project"))

    # Get the project
    project = frappe.get_doc("Project", project_name)

    if not project.developer_contact:
        return {
            "status": "error",
            "message": "No developer contact assigned to this project",
        }

    # Directly access the database to get contact info without permission check
    contact = frappe.db.get_value(
        "Contact",
        project.developer_contact,
        ["name", "salutation", "first_name", "last_name", "department", "image"],
        as_dict=1,
    )

    if not contact:
        return {"status": "error", "message": "Contact not found"}

    # Get email and phone data
    emails = frappe.db.get_all(
        "Contact Email",
        filters={"parent": contact.name},
        fields=["email_id", "is_primary"],
    )

    phones = frappe.db.get_all(
        "Contact Phone",
        filters={"parent": contact.name},
        fields=["phone", "is_primary_mobile_no"],
    )

    # Format the response
    full_name = " ".join(
        filter(
            None,
            [
                contact.salutation or "",
                contact.first_name or "",
                contact.last_name or "",
            ],
        )
    )

    # Get primary email
    primary_email = ""
    if emails:
        primary = next((e for e in emails if e.is_primary), emails[0])
        primary_email = primary.email_id

    # Get primary phone
    primary_phone = ""
    if phones:
        primary = next((p for p in phones if p.is_primary_mobile_no), phones[0])
        primary_phone = primary.phone

    return {
        "status": "success",
        "contact": {
            "name": contact.name,
            "full_name": full_name,
            "department": contact.department,
            "image": contact.image,
            "primary_email": primary_email,
            "primary_phone": primary_phone,
        },
    }

